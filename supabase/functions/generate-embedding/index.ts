import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { assetId } = await req.json();

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("file_path, file_type, tenant_id")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      throw new Error("Asset not found");
    }

    // Only process images
    if (!asset.file_type.startsWith("image/")) {
      return new Response(
        JSON.stringify({ success: false, message: "Not an image" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("assets")
      .download(asset.file_path);

    if (downloadError || !fileData) {
      throw new Error("Failed to download file");
    }

    // Generate embedding
    const embedding = await generateEmbedding(fileData, asset.file_type);

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    // Update asset with embedding
    const { error: updateError } = await supabase
      .from("assets")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", assetId);

    if (updateError) {
      throw new Error("Failed to update asset with embedding");
    }

    return new Response(
      JSON.stringify({ success: true, assetId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating embedding:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateEmbedding(fileData: Blob, fileType: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const buffer = await fileData.arrayBuffer();
    const base64 = b64encode(buffer);
    const dataUrl = `data:${fileType};base64,${base64}`;

    // Caption the image
    const captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Describe the image in one short sentence with key objects, scene, and style. Return only the sentence." },
          { role: "user", content: [
            { type: "text", text: "Please describe this image briefly." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]}
        ]
      }),
    });

    if (!captionRes.ok) {
      console.error("Image captioning failed:", await captionRes.text());
      return null;
    }

    const captionData = await captionRes.json();
    const caption: string = captionData.choices?.[0]?.message?.content || "";
    if (!caption) return null;

    console.log("Generated caption:", caption);

    // Generate embedding from caption
    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/text-embedding-004",
        input: caption,
      }),
    });

    if (!embRes.ok) {
      console.error("Embedding generation failed:", await embRes.text());
      return null;
    }

    const data = await embRes.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Error generating embedding:", e);
    return null;
  }
}
