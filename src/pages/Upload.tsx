import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload as UploadIcon, Loader2, ShieldAlert, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  id: string;
  is_fake: boolean;
  confidence_score: number;
  detected_issues: string[];
  analysis_result: {
    analysis_summary: string;
    recommendations: string;
  };
  created_at: string;
}

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [uploadBlocked, setUploadBlocked] = useState(false);
  const { toast } = useToast();

  const verifyContent = async (file: File) => {
    setIsVerifying(true);
    setVerificationResult(null);
    setUploadBlocked(false);

    try {
      // Only verify image files for now
      if (!file.type.startsWith('image/')) {
        setIsVerifying(false);
        return true; // Allow non-image files
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          
          const { data, error } = await supabase.functions.invoke('verify-content', {
            body: { contentType: 'image', contentUrl: base64 }
          });

          if (error) throw error;

          if (data.success) {
            const result = data.result;
            setVerificationResult(result);

            // Check for restricted content
            const restrictedIssues = result.detected_issues.some((issue: string) => 
              issue.toLowerCase().includes('violence') || 
              issue.toLowerCase().includes('protest') || 
              issue.toLowerCase().includes('blood') || 
              issue.toLowerCase().includes('gore') ||
              issue.toLowerCase().includes('racism') ||
              issue.toLowerCase().includes('hate') ||
              issue.toLowerCase().includes('weapon') ||
              issue.toLowerCase().includes('nsfw') ||
              issue.toLowerCase().includes('explicit')
            );

            // Block upload if content is restricted or highly likely to be fake
            if (restrictedIssues || (result.is_fake && result.confidence_score > 80)) {
              setUploadBlocked(true);
              toast({
                title: "Upload Blocked",
                description: restrictedIssues 
                  ? "Content contains restricted material and cannot be uploaded"
                  : "Content appears to be fake/manipulated and cannot be uploaded",
                variant: "destructive",
              });
            } else if (result.is_fake) {
              toast({
                title: "Content Warning",
                description: "Content may be fake or manipulated. Please review before proceeding.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Content Verified",
                description: "Content appears authentic and safe to upload",
              });
            }
          } else {
            throw new Error(data.error || 'Verification failed');
          }
        } catch (error: any) {
          console.error('Verification error:', error);
          toast({
            title: "Verification Failed",
            description: "Could not verify content. Upload will proceed with caution.",
            variant: "destructive",
          });
        } finally {
          setIsVerifying(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Could not verify content. Upload will proceed with caution.",
        variant: "destructive",
      });
      setIsVerifying(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setVerificationResult(null);
    setUploadBlocked(false);

    if (selectedFile && selectedFile.type.startsWith('image/')) {
      await verifyContent(selectedFile);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // Block upload if content is restricted
    if (uploadBlocked) {
      toast({
        title: "Upload Blocked",
        description: "This content cannot be uploaded due to policy violations",
        variant: "destructive",
      });
      return;
    }

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

      // Track upload event for analytics
      await supabase.from("analytics_events").insert({
        tenant_id: profile.tenant_id,
        asset_id: insertedAsset.id,
        event_type: 'upload',
      });

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });

      setFile(null);
      setDescription("");
      setTags("");
      setVerificationResult(null);
      setUploadBlocked(false);
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
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Upload Asset</h1>
        <Badge variant="outline" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Content Moderation Protected
        </Badge>
      </div>

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
                onChange={handleFileChange}
                required
                disabled={isUploading || isVerifying}
              />
              {isVerifying && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying content with Content Moderation...
                </div>
              )}
            </div>

            {/* Verification Results */}
            {verificationResult && (
              <Card className={`border-2 ${uploadBlocked ? 'border-red-500' : verificationResult.is_fake ? 'border-yellow-500' : 'border-green-500'}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Content Moderation Analysis
                    </span>
                    {uploadBlocked ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Upload Blocked
                      </Badge>
                    ) : verificationResult.is_fake ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Potentially Fake
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Appears Authentic
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="text-sm">
                    <strong>Confidence Score:</strong> {verificationResult.confidence_score}%
                  </div>

                  {/* Content Restriction Warning - Highest Priority */}
                  {uploadBlocked && (
                    <Alert variant="destructive" className="border-red-600">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertDescription className="font-semibold">
                        ⛔ UPLOAD BLOCKED
                        <p className="mt-1 font-normal text-sm">
                          This content contains restricted material and cannot be uploaded to the system.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {verificationResult.detected_issues.length > 0 && (
                    <Alert variant={uploadBlocked ? "destructive" : "default"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-1">Detected Issues:</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {verificationResult.detected_issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-sm">
                    <div className="font-semibold mb-1">Analysis:</div>
                    <p className="text-muted-foreground">
                      {verificationResult.analysis_result.analysis_summary}
                    </p>
                  </div>

                  {verificationResult.analysis_result.recommendations && (
                    <div className="text-sm">
                      <div className="font-semibold mb-1">Recommendations:</div>
                      <p className="text-muted-foreground">
                        {verificationResult.analysis_result.recommendations}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter asset description..."
                disabled={isUploading || isVerifying}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., logo, brand, marketing"
                disabled={isUploading || isVerifying}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isUploading || isVerifying || !file || uploadBlocked}
              variant={uploadBlocked ? "destructive" : "default"}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : uploadBlocked ? (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Upload Blocked
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Upload Asset
                </>
              )}
            </Button>

            {verificationResult && !uploadBlocked && verificationResult.is_fake && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This content may be fake or manipulated. 
                  Proceed with caution and verify the authenticity from other sources.
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Upload;