import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Folder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const Folders = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const { toast } = useToast();

  const fetchFolders = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profile) {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch folders",
          variant: "destructive",
        });
      } else {
        setFolders(data || []);
      }
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const validateFolderName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName && name.length > 0) {
      return "Folder name cannot contain only spaces";
    }
    if (trimmedName.length > 100) {
      return "Folder name must be 100 characters or less";
    }
    // Check for existing folder names (case-insensitive)
    const existingFolder = folders.find(
      folder => folder.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingFolder) {
      return "A folder with this name already exists";
    }
    return "";
  };

  const handleNameChange = (value: string) => {
    setNewFolderName(value);
    setNameError(validateFolderName(value));
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Clear form and errors when dialog is closed
      setNewFolderName("");
      setNewFolderDescription("");
      setNameError("");
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      toast({
        title: "Invalid Input",
        description: "Folder name cannot be empty or contain only spaces.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length > 100) {
      toast({
        title: "Invalid Input",
        description: "Folder name must be 100 characters or less.",
        variant: "destructive",
      });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profile) {
      // Check for existing folder with the same name (case-insensitive)
      const { data: existingFolders, error: checkError } = await supabase
        .from("folders")
        .select("name")
        .eq("tenant_id", profile.tenant_id)
        .ilike("name", trimmedName);

      if (checkError) {
        toast({
          title: "Error",
          description: "Failed to check for existing folders",
          variant: "destructive",
        });
        return;
      }

      if (existingFolders && existingFolders.length > 0) {
        toast({
          title: "Folder Already Exists",
          description: `A folder named "${trimmedName}" already exists. Please choose a different name.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("folders").insert({
        tenant_id: profile.tenant_id,
        name: trimmedName,
        description: newFolderDescription.trim(),
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create folder",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Folder created successfully",
          variant: "success",
        });
        setNewFolderName("");
        setNewFolderDescription("");
        setNameError("");
        setIsDialogOpen(false);
        fetchFolders();
      }
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const { error } = await supabase.from("folders").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Folder deleted successfully",
        variant: "success",
      });
      fetchFolders();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Folders</h1>
          <p className="text-gray-600 mt-2">Organize your assets into folders for better management</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <Plus className="mr-2 h-4 w-4" />
              Create Folder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-white" />
                </div>
                Create New Folder
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateFolder} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="folder-name" className="text-sm font-medium text-gray-700">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Enter folder name..."
                  className={`transition-all duration-200 ${nameError ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200" : "focus:border-blue-500 focus:ring-blue-200"}`}
                />
                {nameError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-500"></span>
                    {nameError}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <Label htmlFor="folder-description" className="text-sm font-medium text-gray-700">Description (Optional)</Label>
                <Input
                  id="folder-description"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="focus:border-blue-500 focus:ring-blue-200 transition-all duration-200"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={!!nameError || !newFolderName.trim()}
              >
                Create Folder
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <Card key={folder.id} className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <CardHeader className="relative z-10 pb-3">
              <CardTitle className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 flex-1 group-hover:text-blue-600 transition-colors duration-300"
                  onClick={() => window.location.href = `/dashboard/folders/${folder.id}`}
                >
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <FolderOpen className="h-5 w-5 text-white" />
                  </div>
                  <span className="truncate font-semibold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">{folder.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 pt-0" onClick={() => window.location.href = `/dashboard/folders/${folder.id}`}>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {folder.description || "No description provided"}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full border">
                  📅 {new Date(folder.created_at).toLocaleDateString()}
                </p>
                <div className="flex items-center text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></div>
                  Open
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Folders;