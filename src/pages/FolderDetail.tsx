import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload as UploadIcon, Download, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Folder {
  id: string;
  name: string;
  description: string | null;
}

interface Asset {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  tags: string[] | null;
  created_at: string;
  file_path: string;
}

const FolderDetail = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchFolder = async () => {
    if (!folderId) return;

    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("id", folderId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch folder",
        variant: "destructive",
      });
    } else {
      setFolder(data);
    }
  };

  const fetchAssets = async () => {
    if (!folderId) return;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch assets",
        variant: "destructive",
      });
    } else {
      setAssets(data || []);
    }
  };

  useEffect(() => {
    fetchFolder();
    fetchAssets();
  }, [folderId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !folderId) return;

    setUploading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) {
        throw new Error("Profile not found");
      }

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${profile.tenant_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("assets").insert({
        tenant_id: profile.tenant_id,
        name: selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        description,
        tags: tags ? tags.split(",").map((tag) => tag.trim()) : null,
        folder_id: folderId,
      });

      if (dbError) throw dbError;

      // Track upload event
      await supabase.from("analytics_events").insert({
        tenant_id: profile.tenant_id,
        asset_id: null,
        event_type: 'upload',
      });

      toast({
        title: "Success",
        description: "Asset uploaded successfully",
        variant: "success",
      });

      setSelectedFile(null);
      setDescription("");
      setTags("");
      setIsDialogOpen(false);
      fetchAssets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload asset",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    const { error: storageError } = await supabase.storage
      .from("assets")
      .remove([filePath]);

    if (storageError) {
      toast({
        title: "Error",
        description: "Failed to delete file from storage",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("assets").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Asset deleted successfully",
        variant: "success",
      });
      fetchAssets();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadAssetUrls = async () => {
      const urls: Record<string, string> = {};
      for (const asset of assets) {
        const { data } = await supabase.storage
          .from("assets")
          .createSignedUrl(asset.file_path, 3600); // 1 hour expiry
        if (data?.signedUrl) {
          urls[asset.id] = data.signedUrl;
        }
      }
      setAssetUrls(urls);
    };
    
    if (assets.length > 0) {
      loadAssetUrls();
    }
  }, [assets]);

  const isImageFile = (fileType: string) => {
    return fileType.startsWith("image/");
  };

  const trackEvent = async (assetId: string, eventType: 'view' | 'download') => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profile) {
      await supabase.from("analytics_events").insert({
        tenant_id: profile.tenant_id,
        asset_id: assetId,
        event_type: eventType,
      });
    }
  };

  const handleView = async (asset: Asset) => {
    await trackEvent(asset.id, 'view');
    if (assetUrls[asset.id]) {
      window.open(assetUrls[asset.id], "_blank");
    }
  };

  const handleDownloadAsset = async (asset: Asset) => {
    await trackEvent(asset.id, 'download');
    if (assetUrls[asset.id]) {
      const a = document.createElement('a');
      a.href = assetUrls[asset.id];
      a.download = asset.name;
      a.click();
    }
  };

  if (!folder) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/folders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{folder.name}</h1>
          {folder.description && (
            <p className="text-muted-foreground mt-1">{folder.description}</p>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UploadIcon className="mr-2 h-4 w-4" />
              Upload Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Asset to {folder.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="marketing, banner, 2024"
                />
              </div>
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload Asset"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assets in this folder</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No assets in this folder yet. Upload your first asset!
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <Card key={asset.id} className="overflow-hidden">
                  <CardHeader className="p-0">
                    {isImageFile(asset.file_type) ? (
                      <div className="aspect-video w-full bg-muted flex items-center justify-center overflow-hidden">
                        {assetUrls[asset.id] ? (
                          <img
                            src={assetUrls[asset.id]}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-muted flex items-center justify-center">
                        <div className="text-center">
                          <UploadIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-2">
                            {asset.file_type}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate mb-2">{asset.name}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Size: {formatFileSize(asset.file_size)}</p>
                      <p>Type: {asset.file_type}</p>
                      {asset.tags && asset.tags.length > 0 && (
                        <p>Tags: {asset.tags.join(", ")}</p>
                      )}
                      <p>Created: {new Date(asset.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleView(asset)}
                        disabled={!assetUrls[asset.id]}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAsset(asset)}
                        disabled={!assetUrls[asset.id]}
                      >
                        <Download className="h-4 w-4 mr-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(asset.id, asset.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FolderDetail;
