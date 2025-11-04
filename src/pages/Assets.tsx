import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, Eye, FileText, Image, Film, Music, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Asset {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  tags: string[];
  created_at: string;
  file_path: string;
}

const Assets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchAssets = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profile) {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
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
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isImageFile = (fileType: string) => {
    return fileType.startsWith("image/");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return Image;
    if (fileType.startsWith("video/")) return Film;
    if (fileType.startsWith("audio/")) return Music;
    if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("archive")) return Archive;
    return FileText;
  };

  // Load asset URLs for thumbnails
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
    const { data } = await supabase.storage
      .from("assets")
      .createSignedUrl(asset.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleDownload = async (asset: Asset) => {
    await trackEvent(asset.id, 'download');
    const { data } = await supabase.storage
      .from("assets")
      .createSignedUrl(asset.file_path, 3600);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = asset.name;
      a.click();
    }
  };

  const handleDelete = async (id: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Assets</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Assets</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or tags..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No assets found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => {
                  const FileIcon = getFileIcon(asset.file_type);
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {isImageFile(asset.file_type) && assetUrls[asset.id] ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              <img
                                src={assetUrls[asset.id]}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <FileIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{asset.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset.file_type}
                            </div>
                          </div>
                        </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{asset.file_type}</span>
                    </TableCell>
                    <TableCell>{formatFileSize(asset.file_size)}</TableCell>
                    <TableCell>
                      {asset.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs mr-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      {new Date(asset.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleView(asset)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(asset)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(asset.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Assets;