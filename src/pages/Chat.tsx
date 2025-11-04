import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  path: string;
  name: string;
  type: string;
  size: number;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AIVA Assistant. I can help you manage your digital assets through natural language commands.\n\n✨ **What I can help you with:**\n• Create folders (I'll check for duplicates automatically)\n• List and view all your folders\n• List and search your assets\n• Upload and organize files\n• Show analytics and insights\n• Answer questions about your content\n\n💡 **Try asking me:**\n• \"Create a new folder called 'Project Photos'\"\n• \"Show me all my folders\" or \"Get list of folders\"\n• \"List of assets\" or \"I want to see all assets\"\n• \"Find assets containing 'whatsapp'\"\n• \"Upload this file to the Marketing folder\"\n• \"What's in my Documents folder?\"\n\nJust tell me what you'd like to do in your own words!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(isLoading === false){
    promptInputRef.current?.focus();
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsLoading(true);

    try {
      // Get user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Upload file to temporary location in assets bucket
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.tenant_id}/temp/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file, {
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      setUploadedFile({
        path: filePath,
        name: file.name,
        type: file.type,
        size: file.size,
      });

      toast({
        title: "✅ File uploaded successfully",
        description: `${file.name} is ready in temporary storage. Tell me what you'd like to do with it, or use the Upload page for manual processing.`,
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const checkForDuplicateFolder = async (folderName: string): Promise<boolean> => {
    try {
      // Get user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return false;

      // Check for existing folder with the same name (case-insensitive)
      const { data: existingFolders, error } = await supabase
        .from("folders")
        .select("name")
        .eq("tenant_id", profile.tenant_id)
        .ilike("name", folderName.trim());

      if (error) {
        console.error("Error checking for duplicate folders:", error);
        return false;
      }

      return existingFolders && existingFolders.length > 0;
    } catch (error) {
      console.error("Error in duplicate folder check:", error);
      return false;
    }
  };

  const getAllFolders = async (): Promise<any[]> => {
    try {
      // Get user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      // Fetch all folders for the user
      const { data: folders, error } = await supabase
        .from("folders")
        .select("id, name, description, created_at")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching folders:", error);
        return [];
      }

      return folders || [];
    } catch (error) {
      console.error("Error in getAllFolders:", error);
      return [];
    }
  };

  const getAllAssets = async (searchQuery?: string): Promise<any[]> => {
    try {
      // Get user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      // Build query for assets with folder information
      let query = supabase
        .from("assets")
        .select(`
          id, 
          name, 
          file_path, 
          file_type, 
          file_size, 
          created_at,
          folder:folders(name)
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      // Add search filter if provided
      if (searchQuery && searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery.trim()}%`);
      }

      const { data: assets, error } = await query;

      if (error) {
        console.error("Error fetching assets:", error);
        return [];
      }

      return assets || [];
    } catch (error) {
      console.error("Error in getAllAssets:", error);
      return [];
    }
  };

  const extractFolderNameFromMessage = (message: string): string | null => {
    console.log("AIVA Debug - Extracting folder name from:", message);
    
    // Enhanced patterns to catch more natural language variations
    const patterns = [
      // Quoted folder names (highest priority)
      /create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called\s+|named\s+)?["']([^"']+)["']/i,
      /new\s+folder\s+(?:called\s+|named\s+)?["']([^"']+)["']/i,
      /make\s+(?:a\s+)?folder\s+(?:called\s+|named\s+)?["']([^"']+)["']/i,
      /add\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called\s+|named\s+)?["']([^"']+)["']/i,
      /folder\s+(?:called\s+|named\s+)?["']([^"']+)["']/i,
      
      // Single word or multi-word folder names
      /create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called\s+|named\s+)?([\w\s-]+?)(?:\s|$)/i,
      /new\s+folder\s+(?:called\s+|named\s+)?([\w\s-]+?)(?:\s|$)/i,
      /make\s+(?:a\s+)?folder\s+(?:called\s+|named\s+)?([\w\s-]+?)(?:\s|$)/i,
      /add\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called\s+|named\s+)?([\w\s-]+?)(?:\s|$)/i,
      
      // More natural patterns
      /(?:please\s+)?(?:can\s+you\s+)?create\s+(?:a\s+)?folder\s+(?:for\s+)?([\w\s-]+?)(?:\s+please)?$/i,
      /i\s+(?:want\s+to\s+|need\s+to\s+)?create\s+(?:a\s+)?folder\s+(?:called\s+)?([\w\s-]+)/i,
      /add\s+(?:a\s+)?(?:new\s+)?folder\s+([\w\s-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const folderName = match[1].trim();
        // Clean up common trailing words
        const cleanedName = folderName.replace(/\s+(please|folder|to\s+it|for\s+me)$/i, '').trim();
        console.log("AIVA Debug - Extracted folder name:", cleanedName, "from pattern:", pattern);
        return cleanedName;
      }
    }

    console.log("AIVA Debug - No folder name extracted from message");
    return null;
  };

  const checkDuplicateAndCreateFolder = async (folderName: string, userMessage: string): Promise<boolean> => {
    try {
      console.log("AIVA Debug - Starting duplicate check for:", folderName);
      
      // First check for duplicates locally
      const isDuplicate = await checkForDuplicateFolder(folderName);
      
      console.log("AIVA Debug - Duplicate check result:", { folderName, isDuplicate });
      
      if (isDuplicate) {
        const currentYear = new Date().getFullYear();
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `❌ **Duplicate Folder Detected by AIVA**

A folder named "${folderName}" already exists in your workspace.

🤖 **AIVA's Smart Suggestions:**
• "${folderName}_v2" or "${folderName}_new"
• "${folderName}_${currentYear}" (add current year)
• "${folderName}_projects" or "${folderName}_docs"
• "Personal_${folderName}" or "Work_${folderName}"

💡 **Alternative Actions:**
• Say: "Create folder called '${folderName}_v2'"
• Say: "Show me all my folders" to see existing ones
• Go to **Folders** page to manage manually
• Use more specific names like "Marketing_${folderName}"

Just tell me what you'd like to call the new folder instead!`
          }
        ]);
        
        toast({
          title: "🤖 AIVA Duplicate Check",
          description: `Folder "${folderName}" already exists. I've suggested alternatives!`,
          variant: "destructive",
        });
        
        return false; // Duplicate found
      }
      
      // No duplicate found, show success and let AIVA handle creation
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `✅ **AIVA Validation Complete**

Folder name "${folderName}" is available! 

🤖 **Processing your request...**
I'll now create the folder for you using the AIVA Assistant backend.`
        }
      ]);
      
      return true; // No duplicate, safe to proceed
      
    } catch (error) {
      console.error("Error in AIVA duplicate check:", error);
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `⚠️ **AIVA Duplicate Check Warning**

I couldn't verify if "${folderName}" already exists due to a connection issue.

🤖 **Proceeding with caution...**
I'll attempt to create the folder, but the backend may reject it if it's a duplicate.

If creation fails, try:
• Refresh the page and try again
• Go to **Folders** page to check existing folders
• Use a more unique folder name`
        }
      ]);
      
      return true; // Allow to proceed despite check failure
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !uploadedFile) || isLoading) return;

    const userMessage = input.trim();
    const fileInfo = uploadedFile;
    
    // Clear input and file states immediately
    setInput("");
    setSelectedFile(null);
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Check if user is trying to create a folder - Enhanced detection
    const isFolderCreation = userMessage.toLowerCase().includes('create folder') || 
                           userMessage.toLowerCase().includes('new folder') ||
                           userMessage.toLowerCase().includes('make folder') ||
                           userMessage.toLowerCase().includes('add folder') ||
                           userMessage.toLowerCase().includes('create a folder') ||
                           userMessage.toLowerCase().includes('make a folder') ||
                           userMessage.toLowerCase().includes('add a folder') ||
                           /(?:please\s+)?(?:can\s+you\s+)?create.*folder/i.test(userMessage) ||
                           /(?:i\s+)?(?:want\s+to\s+|need\s+to\s+)?create.*folder/i.test(userMessage) ||
                           /folder\s+(?:called|named)/i.test(userMessage);
    
    // Check if user is requesting folder list
    const isFolderListRequest = userMessage.toLowerCase().includes('list of folders') ||
                              userMessage.toLowerCase().includes('show folders') ||
                              userMessage.toLowerCase().includes('get folders') ||
                              userMessage.toLowerCase().includes('all folders') ||
                              userMessage.toLowerCase().includes('list folders') ||
                              userMessage.toLowerCase().includes('show all folders') ||
                              userMessage.toLowerCase().includes('what folders') ||
                              userMessage.toLowerCase().includes('folders in the system');
    
    // Check if user is requesting asset list
    const isAssetListRequest = userMessage.toLowerCase().includes('list of assets') ||
                             userMessage.toLowerCase().includes('show assets') ||
                             userMessage.toLowerCase().includes('get assets') ||
                             userMessage.toLowerCase().includes('all assets') ||
                             userMessage.toLowerCase().includes('list assets') ||
                             userMessage.toLowerCase().includes('show all assets') ||
                             userMessage.toLowerCase().includes('what assets') ||
                             userMessage.toLowerCase().includes('see all assets') ||
                             userMessage.toLowerCase().includes('i want to see all assets');

    // Extract search query for assets
    const extractAssetSearchQuery = (message: string): string | null => {
      const patterns = [
        /assets?\s+(?:with\s+)?(?:name\s+)?(?:contains?\s+)?["']([^"']+)["']/i,
        /assets?\s+(?:named?\s+)?(?:called\s+)?["']([^"']+)["']/i,
        /search\s+(?:for\s+)?(?:assets?\s+)?["']([^"']+)["']/i,
        /find\s+(?:assets?\s+)?["']([^"']+)["']/i,
        /(?:name\s+contains?\s+)([^\s]+)/i,
      ];

      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return null;
    };

    const searchQuery = extractAssetSearchQuery(userMessage);
    
    const displayMessage = fileInfo 
      ? `${userMessage}\n[Attached: ${fileInfo.name}]`
      : userMessage;

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: displayMessage }]);

    // Handle asset list request
    if (isAssetListRequest || searchQuery) {
      setIsLoading(true);
      
      // Show loading message
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: searchQuery 
            ? `🔍 Searching for assets containing "${searchQuery}"...`
            : `📄 Fetching your assets...`
        }
      ]);
      
      try {
        const assets = await getAllAssets(searchQuery);
        
        // Remove the loading message
        setMessages((prev) => prev.slice(0, -1));
        
        if (assets.length === 0) {
          const noResultsMessage = searchQuery 
            ? `🔍 **No Assets Found**

No assets found containing "${searchQuery}".

💡 **Try:**
• Check spelling and try different keywords
• Search for partial names like "photo", "doc", etc.
• Use "list of assets" to see all assets
• Go to the **Assets** page to browse manually

Would you like to see all your assets instead?`
            : `📄 **No Assets Found**

You don't have any assets yet in your workspace.

💡 **Get Started:**
• Upload your first file by clicking the 📎 button below
• Or go to the **Upload** page to add files manually
• Create folders first to organize your assets

Would you like me to help you upload a file?`;
          
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: noResultsMessage }
          ]);
        } else {
          const assetList = assets.map((asset, index) => {
            const createdDate = new Date(asset.created_at).toLocaleDateString();
            const fileSize = asset.file_size ? `${(asset.file_size / 1024).toFixed(1)} KB` : 'Unknown size';
            const folderName = asset.folder?.name || 'No folder';
            const fileType = asset.file_type || 'Unknown type';
            
            return `${index + 1}. **${asset.name}**
   📁 Folder: ${folderName}
   📋 Type: ${fileType}
   📏 Size: ${fileSize}
   📅 Created: ${createdDate}`;
          }).join('\n\n');
          
          const resultTitle = searchQuery 
            ? `🔍 **Search Results for "${searchQuery}" (${assets.length} found)**`
            : `📄 **Your Assets (${assets.length} total)**`;
          
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: `${resultTitle}

${assetList}

💡 **What you can do:**
• View details: "Show me details for [asset name]"
• Search more: "Find assets containing [keyword]"
• Upload new files: Click 📎 or go to **Upload** page
• Organize: Move assets to folders using **Assets** page

Need help with any specific asset?`
            }
          ]);
        }
        
        setIsLoading(false);
        return; // Exit early since we handled the request
      } catch (error) {
        console.error("Error fetching assets:", error);
        setMessages((prev) => prev.slice(0, -1)); // Remove loading message
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `❌ **Error Fetching Assets**

I couldn't retrieve your assets due to a technical issue.

🔧 **Try these alternatives:**
• Go to the **Assets** page to see your files
• Refresh the page and try again
• Check your internet connection

Would you like me to help you with something else?`
          }
        ]);
        setIsLoading(false);
        return;
      }
    }

    // Handle folder list request
    if (isFolderListRequest) {
      setIsLoading(true);
      
      // Show loading message
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `📂 Fetching your folders...`
        }
      ]);
      
      try {
        const folders = await getAllFolders();
        
        // Remove the loading message
        setMessages((prev) => prev.slice(0, -1));
        
        if (folders.length === 0) {
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: `📁 **No Folders Found**

You don't have any folders yet in your workspace.

💡 **Get Started:**
• Create your first folder by saying: "Create a new folder called My Documents"
• Or go to the **Folders** page to create folders manually
• Upload files and organize them into folders for better management

Would you like me to help you create your first folder?`
            }
          ]);
        } else {
          const folderList = folders.map((folder, index) => {
            const createdDate = new Date(folder.created_at).toLocaleDateString();
            const description = folder.description || "No description";
            return `${index + 1}. **${folder.name}**\n   📝 ${description}\n   📅 Created: ${createdDate}`;
          }).join('\n\n');
          
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: `📂 **Your Folders (${folders.length} total)**

${folderList}

💡 **What you can do:**
• Create new folders: "Create a folder called [name]"
• Upload files: "Upload this file to [folder name]"
• Get folder details: "What's in [folder name]?"
• Go to **Folders** page for more management options

Which folder would you like to work with?`
            }
          ]);
        }
        
        setIsLoading(false);
        return; // Exit early since we handled the request
      } catch (error) {
        console.error("Error fetching folders:", error);
        setMessages((prev) => prev.slice(0, -1)); // Remove loading message
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `❌ **Error Fetching Folders**

I couldn't retrieve your folders due to a technical issue.

🔧 **Try these alternatives:**
• Go to the **Folders** page to see your folders
• Refresh the page and try again
• Check your internet connection

Would you like me to help you with something else?`
          }
        ]);
        setIsLoading(false);
        return;
      }
    }

    // Handle folder creation with enhanced AIVA duplicate check
    if (isFolderCreation) {
      const folderName = extractFolderNameFromMessage(userMessage);
      
      console.log("AIVA Debug - Folder Creation Request:", {
        userMessage,
        isFolderCreation,
        extractedFolderName: folderName
      });
      
      if (folderName) {
        setIsLoading(true);
        
        // Show AIVA checking message
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `🤖 **AIVA Duplicate Check Initiated**

Analyzing request: "${userMessage}"
Extracted folder name: "${folderName}"

🔍 Checking if this folder already exists in your workspace...`
          }
        ]);
        
        try {
          // Use enhanced AIVA duplicate checking
          const canProceed = await checkDuplicateAndCreateFolder(folderName, userMessage);
          
          // Remove only the checking message, keep the result
          setMessages((prev) => prev.slice(0, -1)); // Remove just the AIVA check message
          
          if (!canProceed) {
            setIsLoading(false);
            return; // EXIT HERE - Duplicate found, AIVA has provided alternatives
          }
          
          // If we get here, no duplicate found - proceed with AIVA backend creation
          
        } catch (error) {
          console.error("Error in AIVA duplicate processing:", error);
          
          // Remove the checking message and show error
          setMessages((prev) => prev.slice(0, -1));
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: `❌ **AIVA Error**

I encountered an issue while checking for duplicate folders.

🔧 **Fallback Options:**
• Go to **Folders** page to create manually
• Try again with a different folder name
• Refresh the page and retry

The error has been logged for debugging.`
            }
          ]);
          
          setIsLoading(false);
          return;
        }
      } else {
        // Could not extract folder name from message
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `🤖 **AIVA Parsing Notice**

I detected a folder creation request but couldn't determine the exact folder name from:
"${userMessage}"

💡 **Please try these formats:**
• "Create a folder called 'My Documents'"
• "Make a new folder named Project Files"
• "Add folder Marketing_2024"
• "Please create a folder called Team Resources"

I work best with clear folder names in quotes or specific naming patterns!`
          }
        ]);
        
        setIsLoading(false);
        return;
      }
    }

    // Only proceed with AIVA backend call if we haven't returned due to duplicate folder
    setIsLoading(true);

    // Enhanced safety check: If this is folder creation, verify one more time before AIVA backend call
    if (isFolderCreation) {
      const folderName = extractFolderNameFromMessage(userMessage);
      if (folderName) {
        try {
          const finalDuplicateCheck = await checkForDuplicateFolder(folderName);
          if (finalDuplicateCheck) {
            setMessages((prev) => [
              ...prev,
              { 
                role: "assistant", 
                content: `❌ **AIVA Final Safety Check Failed**

🤖 **Race Condition Detected:**
A folder named "${folderName}" was created by another user or session during processing.

**AIVA Security Protocol Activated:**
Folder creation has been cancelled to prevent conflicts.

💡 **Next Steps:**
• Refresh the page and try again
• Use a more unique folder name like "${folderName}_${Date.now()}"
• Go to **Folders** page to see the newly created folder
• Try: "Create folder called '${folderName}_v2'"`
              }
            ]);
            setIsLoading(false);
            return; // Final safety exit with AIVA context
          }
        } catch (error) {
          console.error("AIVA final duplicate check failed:", error);
          // Continue with creation if final check fails due to network issues
        }
      }
    }

    try {
      const history = [...messages, { role: "user", content: userMessage }];
      
      // Debug logging
      console.log("Sending to chat assistant:", {
        messages: history,
        uploaded_file: fileInfo,
      });

      const { data, error } = await supabase.functions.invoke("chat-assistant", {
        body: { 
          messages: history,
          uploaded_file: fileInfo,
        },
      });

      console.log("Chat assistant response:", { data, error });

      if (error) {
        // Provide specific error handling and solutions
        if (error.message?.includes("Function not found") || error.message?.includes("404")) {
          const fallbackResponse = fileInfo 
            ? `✅ Your file "${fileInfo.name}" is uploaded to temporary storage successfully!

❌ However, the AI chat assistant function isn't deployed yet, so I can't process it automatically.

**You can still upload your file using these options:**

🔹 **Option 1**: Go to the **Upload** page → select your file → choose folder → upload
🔹 **Option 2**: Go to **Folders** page → click a folder → use "Upload Asset" button
🔹 **Option 3**: Deploy the chat function following SETUP_GUIDE.md

Your file is safely stored and ready to be processed manually! 📁`
            : isFolderCreation 
              ? "❌ The AI chat assistant isn't deployed yet. You can create folders manually by going to the **Folders** page and clicking 'Create Folder'. Follow SETUP_GUIDE.md to enable AI assistant features."
              : "❌ The chat assistant function isn't deployed. You can still use the Upload and Folders pages for file management, or follow SETUP_GUIDE.md to deploy the AI assistant.";
          
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fallbackResponse },
          ]);
          return;
        }
        
        // Handle other specific errors
        if (error.message?.includes("LOVABLE_API_KEY")) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "❌ AI functionality requires LOVABLE_API_KEY configuration. Check SETUP_GUIDE.md for instructions, or use the Upload/Folders pages for manual file management." },
          ]);
          return;
        }
        
        if (error.message?.includes("Backend not configured")) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "❌ Supabase backend not configured. Create a .env file with your Supabase credentials (see SETUP_GUIDE.md), or use the Upload/Folders pages." },
          ]);
          return;
        }
        throw error;
      }

      let responseContent = data?.response || "Sorry, I couldn't process that request.";
      
      // Check if the response indicates a folder already exists
      if (responseContent.toLowerCase().includes('folder already exists') || 
          responseContent.toLowerCase().includes('folder exists') ||
          responseContent.toLowerCase().includes('duplicate folder')) {
        responseContent = `❌ **AIVA Backend Duplicate Detection**

${responseContent}

🤖 **AIVA's Analysis:**
Even though my initial check passed, the backend detected a duplicate folder.
This can happen due to:
• Race conditions (multiple users creating folders simultaneously)
• Recent folder creation not yet synchronized
• Backend-specific validation rules

💡 **AIVA Recommendations:**
• Try a different folder name with timestamp: "${extractFolderNameFromMessage(userMessage)}_${new Date().toISOString().slice(0,10)}"
• Check the **Folders** page for recent additions
• Use more specific naming conventions
• Try: "Create folder called '${extractFolderNameFromMessage(userMessage)}_backup'"

I'll learn from this to improve future duplicate detection!`;
      }
      
      // If there was a file but no mention of it in the response, add a natural hint
      const finalResponse = fileInfo && !responseContent.toLowerCase().includes("file") && !responseContent.toLowerCase().includes("upload")
        ? `${responseContent}\n\n💡 I notice you attached "${fileInfo.name}". What would you like me to do with this file?`
        : responseContent;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: finalResponse },
      ]);
    } catch (error: any) {
      console.error("Chat assistant error:", error);
      
      // Enhanced error handling with AIVA-specific messages
      let errorMessage = "Failed to send message";
      
      if (error.message?.includes("duplicate") || error.message?.includes("already exists")) {
        errorMessage = `❌ **AIVA Duplicate Detection Error**

The backend rejected folder creation due to a duplicate name.

🤖 **AIVA's Response:**
My preliminary checks passed, but the backend has stricter validation.
This indicates a race condition or sync delay.

💡 **Try:**
• Use a more unique folder name
• Check **Folders** page for recent additions
• Refresh and retry with timestamp suffix`;
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = `❌ **AIVA Network Error**

Connection to the backend was interrupted.

🤖 **AIVA Status:**
I lost connection to the server. Your request is safe to retry.

🔧 **Solutions:**
• Check your internet connection
• Refresh the page and try again
• Use **Folders** page as backup`;
      } else if (error.message?.includes("auth")) {
        errorMessage = `❌ **AIVA Authentication Error**

Session expired or authentication failed.

🤖 **AIVA Security:**
For your protection, I need you to re-authenticate.

🔐 **Action Required:**
• Refresh the page to re-login
• Check your session hasn't expired
• Contact support if issue persists`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Also add the error message to chat for better UX
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-12rem)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold jato-heading bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          AIVA Assistant
        </h1>
      </div>

      <Card className="h-full flex flex-col jato-card border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="jato-card-header bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-5 w-5" />
            Chat with your AIVA Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 bg-gray-50/50">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 max-h-[calc(100vh-20rem)] chat-scrollbar">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto pr-2 message-scrollbar">
                    {message.content}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {selectedFile && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800 font-medium">{selectedFile.name}</span>
                <span className="text-blue-600">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                disabled={isLoading}
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {uploadedFile && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <Paperclip className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">File ready: {uploadedFile.name}</span>
              </div>
              <p className="text-xs text-emerald-600 mt-1">
                Just tell me what you'd like to do with this file in your own words.
              </p>
            </div>
          )}

          <div className="flex gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !!selectedFile}
              title="Attach file"
              className="border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            
            {/* Debug button for testing duplicate check */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Create a folder called Test")}
              className="hidden md:flex text-xs px-2"
              title="Test duplicate check"
            >
              Test
            </Button>
            
            <Input
              placeholder="Ask me anything about your assets..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              disabled={isLoading}
              autoFocus={true}
              ref={promptInputRef}
              className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <Button 
              onClick={handleSend} 
              disabled={isLoading || (!input.trim() && !uploadedFile)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Chat;