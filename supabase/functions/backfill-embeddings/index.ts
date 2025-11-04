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

    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("No tenant found");

    // Find all image assets without embeddings in user's tenant
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, file_path, file_type, name")
      .eq("tenant_id", profile.tenant_id)
      .is("embedding", null)
      .ilike("file_type", "image/%");

    if (assetsError) throw assetsError;

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No assets to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const asset of assets) {
      try {
        console.log(`Processing ${asset.name}...`);

        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("assets")
          .download(asset.file_path);

        if (downloadError || !fileData) {
          console.error(`Failed to download ${asset.name}:`, downloadError);
          failed++;
          continue;
        }

        // Generate embedding
        const embedding = await generateEmbedding(fileData, asset.file_type);

        if (!embedding) {
          console.error(`Failed to generate embedding for ${asset.name}`);
          failed++;
          continue;
        }

        // Update asset
        const { error: updateError } = await supabase
          .from("assets")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", asset.id);

        if (updateError) {
          console.error(`Failed to update ${asset.name}:`, updateError);
          failed++;
          continue;
        }

        processed++;
        console.log(`Successfully processed ${asset.name}`);
      } catch (error) {
        console.error(`Error processing ${asset.name}:`, error);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: assets.length,
        processed,
        failed,
        message: `Processed ${processed} assets, ${failed} failed`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in backfill:", error);
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
