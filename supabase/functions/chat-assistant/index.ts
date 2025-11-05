import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// CORS headers for web calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types for incoming messages
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

// Tool execution helpers
async function getUserAndTenant(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) throw new Error("Backend not configured");

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) throw new Error("Not authenticated");
  const user = userRes.user;

  // Fetch tenant_id from profiles
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile?.tenant_id) throw new Error("Profile or tenant not found");

  return { supabase, userId: user.id, tenantId: profile.tenant_id as string };
}

async function toolCreateFolder(req: Request, args: any) {
  const { supabase, userId, tenantId } = await getUserAndTenant(req);
  const name = String(args?.name || "").trim();
  const description = (args?.description ? String(args.description) : null) as string | null;
  if (!name) throw new Error("Missing folder name");

  // Validate folder name length and characters
  if (name.length > 100) throw new Error("Folder name is too long (max 100 characters)");
  if (name.length < 1) throw new Error("Folder name cannot be empty");

  try {
    // Attempt to create the folder directly
    // The unique constraint will prevent duplicates at the database level
    const { data, error } = await supabase
      .from("folders")
      .insert({ name, description, tenant_id: tenantId, created_by: userId })
      .select("id, name, description")
      .single();

    if (error) {
      // Check if the error is due to unique constraint violation
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        throw new Error(`A folder named "${name}" already exists. Please choose a different name.`);
      }
      throw new Error(`Failed to create folder: ${error.message}`);
    }

    return { folder: data };
  } catch (dbError: any) {
    // Handle database constraint violations specifically
    if (dbError.message?.includes('already exists') || dbError.message?.includes('unique') || dbError.message?.includes('duplicate')) {
      throw new Error(`A folder named "${name}" already exists. Please choose a different name.`);
    }
    throw dbError;
  }
}

async function toolListFolders(req: Request, args: any) {
  const { supabase, tenantId } = await getUserAndTenant(req);
  
  try {
    // Get folders with asset counts
    const { data: folders, error } = await supabase
      .from("folders")
      .select(`
        id, 
        name, 
        description, 
        created_at, 
        created_by,
        assets(count)
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch folders: ${error.message}`);

    if (!folders || folders.length === 0) {
      return {
        message: "No folders found. You can create your first folder by saying 'Create folder called [FolderName]'.",
        folders: [],
        total_count: 0
      };
    }

    // Format folders with better information
    const formattedFolders = folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description || "No description",
      asset_count: folder.assets?.[0]?.count || 0,
      created_at: new Date(folder.created_at).toLocaleDateString(),
      created_recently: new Date(folder.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }));

    // Create a nice summary message
    const totalFolders = formattedFolders.length;
    const totalAssets = formattedFolders.reduce((sum, folder) => sum + folder.asset_count, 0);
    const recentFolders = formattedFolders.filter(f => f.created_recently).length;

    let message = `📁 Found ${totalFolders} folder${totalFolders !== 1 ? 's' : ''} containing ${totalAssets} asset${totalAssets !== 1 ? 's' : ''} total.`;
    
    if (recentFolders > 0) {
      message += ` ${recentFolders} folder${recentFolders !== 1 ? 's' : ''} created recently.`;
    }

    return { 
      message,
      folders: formattedFolders,
      total_count: totalFolders,
      total_assets: totalAssets
    };
  } catch (dbError: any) {
    throw new Error(`Failed to list folders: ${dbError.message}`);
  }
}

// Generate embeddings for an asset using vision model
async function generateEmbedding(fileData: Blob, fileType: string): Promise<number[] | null> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (!GOOGLE_API_KEY) return null;

  // Only process images for now
  if (!fileType.startsWith("image/")) return null;

  try {
    // Convert blob to base64 (avoid call stack overflow for large files)
    const buffer = await fileData.arrayBuffer();
    const base64 = b64encode(buffer);
    const dataUrl = `data:${fileType};base64,${base64}`;

    // 1) Caption the image concisely using Google Gemini
    const captionRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + GOOGLE_API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Describe the image in one short sentence with key objects, scene, and style. Return only the sentence." },
            { 
              inline_data: {
                mime_type: fileType,
                data: base64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 100,
        }
      }),
    });

    if (!captionRes.ok) {
      console.error("Image captioning failed:", await captionRes.text());
      return null;
    }

    const captionData = await captionRes.json();
    const caption: string = captionData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!caption) return null;

    // 2) Generate a text embedding from the caption using Google Text Embedding
    const embRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + GOOGLE_API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text: caption }]
        }
      }),
    });

    if (!embRes.ok) {
      console.error("Embedding generation failed:", await embRes.text());
      return null;
    }

    const data = await embRes.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("Error generating embedding:", e);
    return null;
  }
}

function guessExtFromContentType(ct: string | null): string {
  if (!ct) return "bin";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return map[ct] || ct.split("/").pop() || "bin";
}

function fileNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "";
    return last || null;
  } catch { return null; }
}

async function toolUploadAssetFromUrl(req: Request, args: any) {
  const { supabase, userId, tenantId } = await getUserAndTenant(req);
  const url = String(args?.url || "").trim();
  const nameArg = args?.name ? String(args.name) : null;
  const description = args?.description ? String(args.description) : null;
  const tags = Array.isArray(args?.tags) ? args.tags.map((t: any) => String(t)) : null;
  let folderId = args?.folder_id ? String(args.folder_id) : null;
  const folderName = args?.folder_name ? String(args.folder_name) : null;

  if (!url) throw new Error("Missing 'url' for upload");

  // Resolve folder by name if id not provided
  if (!folderId && folderName) {
    const { data: folder, error: folderErr } = await supabase
      .from("folders")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", folderName)
      .maybeSingle();
    if (folderErr || !folder) throw new Error("Folder not found by name");
    folderId = folder.id as string;
  }
  if (!folderId) throw new Error("Provide folder_id or folder_name");

  // Fetch file from URL
  const fetchRes = await fetch(url);
  if (!fetchRes.ok) throw new Error(`Failed to fetch file: ${fetchRes.status}`);
  const contentType = fetchRes.headers.get("content-type") || "application/octet-stream";
  const buf = await fetchRes.arrayBuffer();
  const size = buf.byteLength;

  const inferredName = nameArg || fileNameFromUrl(url) || "asset";
  const ext = inferredName.includes(".") ? inferredName.split(".").pop()! : guessExtFromContentType(contentType);
  const finalName = inferredName.includes(".") ? inferredName : `${inferredName}.${ext}`;

  const filePath = `${tenantId}/${crypto.randomUUID()}.${ext}`;
  const blob = new Blob([buf], { type: contentType });

  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(filePath, blob, { contentType });
  if (upErr) throw new Error(upErr.message);

  // Generate embedding for the asset
  const embedding = await generateEmbedding(blob, contentType);

  const { data: inserted, error: insErr } = await supabase
    .from("assets")
    .insert({
      tenant_id: tenantId,
      name: finalName,
      file_path: filePath,
      file_type: contentType,
      file_size: size,
      description,
      tags,
      folder_id: folderId,
      owner_id: userId,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
    })
    .select("id, name, file_type, file_size, folder_id")
    .single();

  if (insErr) throw new Error(insErr.message);
  return { asset: inserted };
}

async function toolUploadSelectedAsset(req: Request, args: any) {
  console.log("toolUploadSelectedAsset called with args:", args);
  
  const { supabase, userId, tenantId } = await getUserAndTenant(req);
  const tempPath = String(args?.temp_file_path || "").trim();
  const nameArg = args?.name ? String(args.name) : null;
  const description = args?.description ? String(args.description) : null;
  const tags = Array.isArray(args?.tags) ? args.tags.map((t: any) => String(t)) : null;
  let folderId = args?.folder_id ? String(args.folder_id) : null;
  const folderName = args?.folder_name ? String(args.folder_name) : null;

  console.log("Processing upload - tempPath:", tempPath, "folderName:", folderName, "folderId:", folderId);

  if (!tempPath) throw new Error("Missing 'temp_file_path' for upload");

  // Resolve folder by name if id not provided
  if (!folderId && folderName) {
    const { data: folder, error: folderErr } = await supabase
      .from("folders")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", folderName)
      .maybeSingle();
    if (folderErr || !folder) {
      // Try to create the folder if it doesn't exist
      const { data: newFolder, error: createErr } = await supabase
        .from("folders")
        .insert({ name: folderName, tenant_id: tenantId, created_by: userId })
        .select("id")
        .single();
      
      if (createErr) throw new Error(`Folder "${folderName}" not found and couldn't be created: ${createErr.message}`);
      folderId = newFolder.id as string;
    } else {
      folderId = folder.id as string;
    }
  }
  if (!folderId) throw new Error("Please specify which folder to upload to (e.g., 'Documents', 'Images', etc.)");

  // Download the temporary file
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("assets")
    .download(tempPath);

  if (downloadError) throw new Error(downloadError.message);

  const size = fileData.size;
  const contentType = fileData.type;

  // Extract extension and generate final path
  const ext = tempPath.split(".").pop() || "bin";
  const finalPath = `${tenantId}/${crypto.randomUUID()}.${ext}`;
  const finalName = nameArg || tempPath.split("/").pop() || `asset.${ext}`;

  // Move file to final location
  const { error: moveError } = await supabase.storage
    .from("assets")
    .move(tempPath, finalPath);

  if (moveError) throw new Error(moveError.message);

  // Generate embedding for the asset
  const embedding = await generateEmbedding(fileData, contentType);

  // Insert asset record
  const { data: inserted, error: insErr } = await supabase
    .from("assets")
    .insert({
      tenant_id: tenantId,
      name: finalName,
      file_path: finalPath,
      file_type: contentType,
      file_size: size,
      description,
      tags,
      folder_id: folderId,
      owner_id: userId,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
    })
    .select("id, name, file_type, file_size, folder_id")
    .single();

  if (insErr) throw new Error(insErr.message);
  return { asset: inserted };
}

async function toolListAssets(req: Request, args: any) {
  const { supabase, tenantId } = await getUserAndTenant(req);
  const limit = args?.limit ? Math.min(Math.max(Number(args.limit), 1), 100) : 20;
  const folderId = args?.folder_id || null;
  const folderName = args?.folder_name || null;

  try {
    let query = supabase
      .from("assets")
      .select(`
        id, 
        name, 
        description, 
        file_type, 
        file_size, 
        tags, 
        created_at,
        folder_id,
        folders!inner(id, name, tenant_id)
      `)
      .eq("folders.tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by specific folder if requested
    if (folderId) {
      query = query.eq("folder_id", folderId);
    } else if (folderName) {
      query = query.eq("folders.name", folderName);
    }

    const { data: assets, error } = await query;

    if (error) throw new Error(`Failed to fetch assets: ${error.message}`);

    const formattedAssets = (assets || []).map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      description: asset.description || "No description",
      file_type: asset.file_type,
      file_size: asset.file_size,
      file_size_mb: (asset.file_size / (1024 * 1024)).toFixed(2),
      tags: asset.tags || [],
      created_at: asset.created_at,
      folder: {
        id: asset.folders.id,
        name: asset.folders.name
      }
    }));

    return { 
      assets: formattedAssets,
      total_count: formattedAssets.length,
      showing_limit: limit
    };
  } catch (dbError: any) {
    throw new Error(`Failed to list assets: ${dbError.message}`);
  }
}

async function toolSearchAssets(req: Request, args: any) {
  const { supabase, tenantId } = await getUserAndTenant(req);
  const query = String(args?.query || "").trim();
  const limit = args?.limit ? Math.min(Math.max(Number(args.limit), 1), 50) : 10;

  if (!query) throw new Error("Missing search query");

  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  
  // Generate embedding for the search query
  let queryEmbedding: number[] | null = null;
  if (GOOGLE_API_KEY) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + GOOGLE_API_KEY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: query }]
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        queryEmbedding = data.embedding?.values || null;
      }
    } catch (e) {
      console.error("Error generating query embedding:", e);
    }
  }

  // If we have a query embedding, perform vector similarity search
  if (queryEmbedding) {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    
    const { data: assets, error } = await supabase.rpc('search_assets_by_embedding', {
      query_embedding: embeddingStr,
      match_threshold: 0.3,
      match_count: limit,
      tenant_filter: tenantId
    });

    if (error) {
      console.error("Vector search error:", error);
      // Fall back to keyword search
    } else if (assets && assets.length > 0) {
      const results = assets.map((asset: any) => ({
        id: asset.id,
        name: asset.name,
        description: asset.description || "No description",
        file_type: asset.file_type,
        file_size: `${(asset.file_size / 1024).toFixed(1)} KB`,
        tags: asset.tags || [],
        similarity: asset.similarity?.toFixed(3),
        created_at: asset.created_at
      }));

      return {
        message: `Found ${results.length} asset${results.length > 1 ? 's' : ''} matching "${query}" using semantic search.`,
        assets: results
      };
    }
  }

  // Fallback to keyword search if vector search fails or returns no results
  const searchPattern = `%${query}%`;
  
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, name, description, file_type, file_size, tags, created_at, folder_id")
    .eq("tenant_id", tenantId)
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern},tags.cs.{${query}}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  if (!assets || assets.length === 0) {
    return { 
      message: `No assets found matching "${query}".`,
      assets: []
    };
  }

  // Format results
  const results = assets.map(asset => ({
    id: asset.id,
    name: asset.name,
    description: asset.description || "No description",
    file_type: asset.file_type,
    file_size: `${(asset.file_size / 1024).toFixed(1)} KB`,
    tags: asset.tags || [],
    created_at: asset.created_at
  }));

  return {
    message: `Found ${results.length} asset${results.length > 1 ? 's' : ''} matching "${query}".`,
    assets: results
  };
}

async function toolBackfillEmbeddings(req: Request): Promise<any> {
  const authHeader = req.headers.get("authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader! } } }
  );

  const { data, error } = await supabase.functions.invoke("backfill-embeddings", {
    body: {}
  });

  if (error) throw error;

  return {
    message: data?.message || "Embeddings generated successfully",
    details: data
  };
}


// Define tools for the AI gateway
const tools = [
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Create a new folder in the current user's tenant. Use this when user requests to create, make, add, or set up a folder. If user says 'create a folder' without specifying a name, ask them what they'd like to call it or suggest a name based on context.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Folder name - extract from user message or ask for clarification if not provided" },
          description: { type: "string", description: "Optional description" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_folders",
      description: "List and view all folders in the current user's tenant. Use this when user asks to see, list, view, or show all folders.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upload_asset_from_url",
      description: "Upload an asset into a folder from a public URL",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Public URL of the file" },
          folder_id: { type: "string", description: "Destination folder id" },
          folder_name: { type: "string", description: "Alternative to folder_id: destination folder name" },
          name: { type: "string", description: "Optional desired file name, with or without extension" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upload_selected_asset",
      description: "Use this whenever a file is attached and the user expresses ANY intent to organize, handle, manage, save, store, keep, file, or do anything with the attached file. This includes casual language, questions about what to do with it, or any organizational intent. Be very liberal in interpretation.",
      parameters: {
        type: "object",
        properties: {
          temp_file_path: { type: "string", description: "Temporary file path in storage (provided in system prompt when file is attached)" },
          folder_id: { type: "string", description: "Destination folder id" },
          folder_name: { type: "string", description: "Destination folder name - infer from context or file type if user doesn't specify (e.g., 'Documents' for PDFs, 'Images' for photos)" },
          name: { type: "string", description: "Optional desired file name" },
          description: { type: "string", description: "Extract any description or context from user message" },
          tags: { type: "array", items: { type: "string" }, description: "Extract any relevant tags from user message or file context" },
        },
        required: ["temp_file_path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_assets",
      description: "List and view all assets or assets in a specific folder. Use this when user asks to see, list, view, show all assets or assets in a folder.",
      parameters: {
        type: "object",
        properties: {
          folder_id: { type: "string", description: "Optional: Filter assets by folder ID" },
          folder_name: { type: "string", description: "Optional: Filter assets by folder name" },
          limit: { type: "number", description: "Maximum number of results to return (1-100, default: 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_assets",
      description: "Search for assets using natural language queries. Searches across asset names, descriptions, tags, and metadata.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (e.g., 'logo', 'pdf documents', 'images from last month')" },
          limit: { type: "number", description: "Maximum number of results to return (1-50, default: 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "backfill_embeddings",
      description: "Generate embeddings for all existing images that don't have them yet. This enables semantic search on image content. Call this when users want to search by image content but results are empty.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const clientMessages: ChatMessage[] | undefined = body.messages;
    const singleMessage: string | undefined = body.message;
    const uploadedFile: any = body.uploaded_file;

    let systemPrompt = `You are a DAM (Digital Asset Management) assistant. Keep answers concise and helpful. 
You can use tools to perform actions like creating folders, listing/viewing all folders, listing/viewing all assets, uploading assets from URLs or processing user-uploaded files, and searching for assets.

FOLDER CREATION HANDLING:
- When users say "create a folder" or "create a new folder" without specifying a name, politely ask what they'd like to call it
- Suggest logical folder names based on context (e.g., "Documents", "Images", "Projects")
- For requests like "make a marketing folder" or "create project folder", extract "marketing" or "project" as the folder name
- Always be helpful and guide users to successful folder creation

TOOL USAGE:
- When users ask to find, search, or look for assets, use the search_assets tool with their query
- When users ask to see, list, view, show, or get all folders, use the list_folders tool - this provides detailed folder information including asset counts
- When users ask to see, list, view, show, or get all assets or files, use the list_assets tool
- If semantic search returns no results for images, automatically use backfill_embeddings to generate embeddings first, then search again
- Only call tools when the user clearly asks to perform an action

Be conversational and helpful while being efficient with your responses.`;

    // Debug logging for uploaded file
    console.log("Uploaded file info:", uploadedFile);

    if (uploadedFile) {
      systemPrompt += `\n\nIMPORTANT: The user has uploaded a file: ${uploadedFile.name} (${uploadedFile.type}, ${(uploadedFile.size / 1024).toFixed(1)} KB).
The file is temporarily stored at path: ${uploadedFile.path}.

You should AUTOMATICALLY use the upload_selected_asset tool when the user expresses ANY intent to:
- Do something with the file (organize, handle, manage, etc.)
- Save or store it somewhere
- Put it in a location or folder
- Process or work with the file
- Mentions any organizational action
- References folders, directories, or storage locations
- Shows any intent to permanently keep the file
- Asks what to do with it or where it should go

Be very liberal in interpreting user intent. Even casual language like "what should I do with this?", "organize this", "keep this somewhere", "I need this filed", "where does this go?", "handle this file" should trigger the upload tool.

When calling upload_selected_asset, use temp_file_path: "${uploadedFile.path}" and intelligently extract:
- Folder names from context (Documents, Images, Photos, Files, etc.)
- Descriptions from their message
- Any organizational intent
- If no folder is specified, suggest an appropriate one based on file type or ask`;
    }

    // Build initial message list
    const coercedMsgs: ChatMessage[] = Array.isArray(clientMessages)
      ? clientMessages.map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? ""),
        }))
      : [];

    const history: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    if (coercedMsgs.length) {
      history.push(...coercedMsgs);
    } else if (singleMessage) {
      history.push({ role: "user", content: String(singleMessage) });
    }

    // Utility to call AI gateway
    async function callAI(msgs: ChatMessage[]) {
      // Convert messages to Google Gemini format
      const contents = msgs.filter(msg => msg.role !== 'system').map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Add system instruction as the first user message if it exists
      const systemMsg = msgs.find(msg => msg.role === 'system');
      if (systemMsg) {
        contents.unshift({
          role: 'user',
          parts: [{ text: systemMsg.content }]
        });
      }

      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + GOOGLE_API_KEY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: contents,
          tools: [{
            function_declarations: tools.map(tool => ({
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
            }))
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          }
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (resp.status === 403) {
          return new Response(
            JSON.stringify({ error: "API key invalid or quota exceeded. Please check your Google API key." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const t = await resp.text();
        console.error("Google AI API error:", resp.status, t);
        return new Response(JSON.stringify({ error: "Google AI API error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      // Convert Google Gemini response to OpenAI-compatible format
      if (data.candidates && data.candidates[0]) {
        const candidate = data.candidates[0];
        const functionCalls = candidate.content?.parts?.filter((part: any) => part.functionCall);
        
        return {
          choices: [{
            message: {
              content: candidate.content?.parts?.find((part: any) => part.text)?.text || "",
              tool_calls: functionCalls?.map((part: any, index: number) => ({
                id: `call_${index}`,
                type: "function",
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args || {})
                }
              })) || []
            }
          }]
        };
      }
      return data;
    }

    // Tool-call loop (max 3 rounds)
    let round = 0;
    let aiData: any = await callAI(history);
    if (aiData instanceof Response) return aiData; // error response

    while (round < 3) {
      const choice = aiData.choices?.[0];
      const msg = choice?.message;
      const toolCalls = msg?.tool_calls as Array<any> | undefined;

      if (toolCalls && toolCalls.length > 0) {
        // Push assistant message with tool calls
        history.push({ role: "assistant", content: msg.content || "", ...(toolCalls ? {} : {}) } as ChatMessage);

        for (const tc of toolCalls) {
          const fnName = tc.function?.name as string;
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}

          let toolResult: any;
          try {
            if (fnName === "create_folder") {
              toolResult = await toolCreateFolder(req, args);
            } else if (fnName === "list_folders") {
              toolResult = await toolListFolders(req, args);
            } else if (fnName === "list_assets") {
              toolResult = await toolListAssets(req, args);
            } else if (fnName === "upload_asset_from_url") {
              toolResult = await toolUploadAssetFromUrl(req, args);
            } else if (fnName === "upload_selected_asset") {
              toolResult = await toolUploadSelectedAsset(req, args);
            } else if (fnName === "search_assets") {
              toolResult = await toolSearchAssets(req, args);
            } else if (fnName === "backfill_embeddings") {
              toolResult = await toolBackfillEmbeddings(req);
            } else {
              toolResult = { error: `Unknown tool: ${fnName}` };
            }
          } catch (toolErr: any) {
            toolResult = { error: `Tool execution failed: ${toolErr.message}` };
          }

          history.push({
            role: "tool",
            tool_call_id: tc.id,
            name: fnName,
            content: JSON.stringify(toolResult),
          } as ChatMessage);
        }

        round++;
        aiData = await callAI(history);
        if (aiData instanceof Response) return aiData;
      } else {
        // No tool calls, we're done
        break;
      }
    }

    // Final response
    const finalChoice = aiData.choices?.[0];
    const finalMessage = finalChoice?.message?.content || "Completed action.";

    return new Response(JSON.stringify({ response: finalMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("chat-assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});