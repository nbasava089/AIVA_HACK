import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload as UploadIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const filePath = `${profile.tenant_id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: insertedAsset, error: dbError } = await supabase
        .from("assets")
        .insert({
          tenant_id: profile.tenant_id,
          name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          description,
          tags: tags.split(",").map((t) => t.trim()),
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Generate embedding for image files
      if (file.type.startsWith("image/")) {
        try {
          await supabase.functions.invoke("generate-embedding", {
            body: { assetId: insertedAsset.id },
          });
        } catch (embeddingError) {
          console.error("Failed to generate embedding:", embeddingError);
          // Don't fail the upload if embedding generation fails
        }
      }

      toast({
        title: "Success",
        description: "File uploaded successfully",
        variant: "success",
      });

      setFile(null);
      setDescription("");
      setTags("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Upload Asset</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Upload New Asset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter asset description..."
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., logo, brand, marketing"
                disabled={isUploading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Upload Asset
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Upload;