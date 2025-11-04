import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Paperclip, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useChatSession } from "@/hooks/useChatSession";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface UploadedFile {
  path: string;
  name: string;
  type: string;
  size: number;
}

const Chat = () => {
  const {
    messages,
    uploadedFile,
    sessionId,
    addMessage,
    updateMessages,
    updateUploadedFile,
    clearSession,
    getSessionInfo,
  } = useChatSession();
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Function to extract folder name from user message
  const extractFolderNameFromMessage = (message: string): string | null => {
    const folderPatterns = [
      // Patterns with quotes
      /create.*folder.*called\s+['""]([^'""]+)['""]?/i,
      /create.*folder.*named\s+['""]([^'""]+)['""]?/i,
      /make.*folder.*called\s+['""]([^'""]+)['""]?/i,
      /make.*folder.*named\s+['""]([^'""]+)['""]?/i,
      /add.*folder\s+['""]([^'""]+)['""]?/i,
      /new.*folder.*called\s+['""]([^'""]+)['""]?/i,
      /new.*folder.*named\s+['""]([^'""]+)['""]?/i,
      /folder.*called\s+['""]([^'""]+)['""]?/i,
      /folder.*named\s+['""]([^'""]+)['""]?/i,
      
      // NEW: Patterns for "name as" and "name called"
      /create.*folder.*name\s+as\s+([A-Za-z0-9_\-\s]+?)(?:\s|$|\.|\?|!)/i,
      /create.*folder.*name\s+called\s+([A-Za-z0-9_\-\s]+?)(?:\s|$|\.|\?|!)/i,
      /make.*folder.*name\s+as\s+([A-Za-z0-9_\-\s]+?)(?:\s|$|\.|\?|!)/i,
      /make.*folder.*name\s+called\s+([A-Za-z0-9_\-\s]+?)(?:\s|$|\.|\?|!)/i,
      
      // Patterns without quotes - more specific
      /create.*folder\s+called\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      /create.*folder\s+named\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      /make.*folder\s+called\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      /make.*folder\s+named\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      /new.*folder\s+called\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      /new.*folder\s+named\s+([A-Za-z0-9_\-\s]+?)(?:\s|$)/i,
      
      // Simple patterns
      /create.*folder\s+([A-Za-z0-9_\-\s]+?)(?:\.|!|\?|$)/i,
      /make.*folder\s+([A-Za-z0-9_\-\s]+?)(?:\.|!|\?|$)/i,
      /new.*folder\s+([A-Za-z0-9_\-\s]+?)(?:\.|!|\?|$)/i,
      /add.*folder\s+([A-Za-z0-9_\-\s]+?)(?:\.|!|\?|$)/i,
    ];

    for (const pattern of folderPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const folderName = match[1].trim();
        // Remove common trailing words
        const cleanName = folderName.replace(/\s+(please|now|for me|today)$/i, '').trim();
        if (cleanName.length > 0) {
          return cleanName;
        }
      }
    }
    return null;
  };

  // Function to check if message is a folder creation request
  const isFolderCreationRequest = (message: string): boolean => {
    const folderKeywords = [
      /create.*folder/i,
      /make.*folder/i,
      /add.*folder/i,
      /new.*folder/i,
      /folder.*name/i,  // Added to catch "folder name as X"
    ];
    
    return folderKeywords.some(pattern => pattern.test(message));
  };

  // Function to validate folder name against existing folders
  const validateFolderName = async (folderName: string): Promise<{ isValid: boolean; error?: string }> => {
    try {
      console.log("🔍 Validating folder name:", folderName);
      
      // Basic validation first
      if (!folderName || !folderName.trim()) {
        return { isValid: false, error: "Folder name cannot be empty." };
      }

      const trimmedName = folderName.trim();
      
      if (trimmedName.length > 100) {
        return { isValid: false, error: "Folder name is too long (max 100 characters)." };
      }

      if (trimmedName.length < 1) {
        return { isValid: false, error: "Folder name cannot be empty." };
      }

      // Get user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("❌ User not authenticated");
        return { isValid: false, error: "Not authenticated" };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) {
        console.log("❌ Tenant not found for user");
        return { isValid: false, error: "Tenant not found" };
      }

      console.log("🏢 Checking for existing folders in tenant:", profile.tenant_id);

      // Check for existing folders with the same name (case-insensitive)
      const { data: existingFolders, error: checkError } = await supabase
        .from("folders")
        .select("name, id")
        .eq("tenant_id", profile.tenant_id)
        .ilike("name", trimmedName);

      if (checkError) {
        console.error("❌ Database error checking folders:", checkError);
        return { isValid: false, error: `Failed to check existing folders: ${checkError.message}` };
      }

      console.log("📊 Existing folders found:", existingFolders);

      if (existingFolders && existingFolders.length > 0) {
        console.log("❌ Duplicate folder detected:", existingFolders[0]);
        return { isValid: false, error: `Folder "${trimmedName}" already exists. Please choose a different name.` };
      }

      console.log("✅ No duplicate folders found, validation passed");
      return { isValid: true };
    } catch (error: any) {
      console.error("❌ Validation error:", error);
      return { isValid: false, error: `Validation failed: ${error.message}` };
    }
  };

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

      updateUploadedFile({
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
    updateUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearChat = () => {
    clearSession();
    toast({
      title: "Chat cleared",
      description: "Your chat history has been cleared.",
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;

    const userMessage = input.trim();
    const fileInfo = uploadedFile;
    
    setInput("");
    setIsLoading(true);

    try {
      const displayMessage = fileInfo 
        ? `${userMessage}\n[Attached: ${fileInfo.name}]`
        : userMessage;

      // Add user message to chat first
      addMessage({ role: "user", content: displayMessage });

      // Check if this is a folder creation request and validate it
      if (isFolderCreationRequest(userMessage)) {
        console.log("🔍 Folder creation request detected:", userMessage);
        const folderName = extractFolderNameFromMessage(userMessage);
        
        if (folderName) {
          console.log("📁 Extracted folder name:", folderName);
          
          const validation = await validateFolderName(folderName);
          
          if (!validation.isValid) {
            console.log("❌ Folder validation failed:", validation.error);
            const errorMessage = `❌ ${validation.error}`;
            addMessage({ role: "assistant", content: errorMessage });
            
            // Show toast notification for duplicate folder
            toast({
              title: "❌ Folder Creation Failed",
              description: validation.error,
              variant: "destructive",
            });
            
            setIsLoading(false);
            return;
          }
          
          console.log("✅ Folder validation passed, proceeding with creation for:", folderName);
        } else {
          console.log("⚠️ Could not extract folder name from message:", userMessage);
          // Check if this might be a folder creation but we couldn't parse it
          if (userMessage.toLowerCase().includes('folder')) {
            const errorMessage = "❌ I couldn't understand the folder name. Please use format like 'Create folder called MyFolder'";
            addMessage({ role: "assistant", content: errorMessage });
            
            toast({
              title: "❌ Invalid Folder Request",
              description: "Please specify folder name clearly like 'Create folder called MyFolder'",
              variant: "destructive",
            });
            
            setIsLoading(false);
            return;
          }
        }
      }

      const requestBody: any = {
        message: userMessage,
        messages: [
          ...messages,
          { role: "user", content: userMessage }
        ]
      };

      if (fileInfo) {
        requestBody.uploaded_file = {
          name: fileInfo.name,
          type: fileInfo.type,
          size: fileInfo.size,
          path: fileInfo.path
        };
      }

      const response = await supabase.functions.invoke("chat-assistant", {
        body: requestBody,
      });

      if (response.error) {
        throw response.error;
      }

      const data = response.data;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      let responseContent = data?.response || "Sorry, I couldn't process that request.";
      
      // Check if this was a successful folder creation
      const wasAttemptingFolderCreation = isFolderCreationRequest(userMessage);
      const folderName = wasAttemptingFolderCreation ? extractFolderNameFromMessage(userMessage) : null;
      
      if (wasAttemptingFolderCreation && folderName && responseContent.toLowerCase().includes("successfully")) {
        // Show success toast for folder creation
        toast({
          title: "✅ Folder Created Successfully",
          description: `Folder "${folderName}" has been created successfully!`,
          variant: "default",
        });
      } else if (responseContent.toLowerCase().includes("successfully") || responseContent.toLowerCase().includes("completed")) {
        // Show general success toast for other successful operations
        toast({
          title: "✅ Success",
          description: "Operation completed successfully!",
          variant: "default",
        });
      }
      
      const finalResponse = fileInfo && !responseContent.toLowerCase().includes("file") && !responseContent.toLowerCase().includes("upload")
        ? `${responseContent}\n\n💡 I notice you attached "${fileInfo.name}". What would you like me to do with this file?`
        : responseContent;

      addMessage({ role: "assistant", content: finalResponse });

      // Clear uploaded file after successful processing
      if (fileInfo) {
        updateUploadedFile(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error: any) {
      console.error("Chat assistant error:", error);
      
      let errorMessage = "Failed to send message. Please try again.";
      let toastTitle = "❌ Error";
      let toastDescription = "Failed to send message. Please try again.";
      
      if (error.message?.includes("duplicate") || error.message?.includes("already exists")) {
        errorMessage = "❌ That folder name already exists. Please try a different name.";
        toastTitle = "❌ Duplicate Folder";
        toastDescription = "A folder with this name already exists. Please choose a different name.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "❌ Network error. Please check your connection and try again.";
        toastTitle = "❌ Network Error";
        toastDescription = "Please check your internet connection and try again.";
      } else if (error.message?.includes("auth")) {
        errorMessage = "❌ Authentication error. Please refresh the page and try again.";
        toastTitle = "❌ Authentication Error";
        toastDescription = "Please refresh the page and login again.";
      } else if (error.message?.includes("permission")) {
        errorMessage = "❌ Permission denied. You don't have access to perform this action.";
        toastTitle = "❌ Permission Denied";
        toastDescription = "You don't have permission to perform this action.";
      } else if (error.message?.includes("timeout")) {
        errorMessage = "❌ Request timeout. Please try again.";
        toastTitle = "❌ Request Timeout";
        toastDescription = "The request took too long. Please try again.";
      }
      
      // Show error toast
      toast({
        title: toastTitle,
        description: toastDescription,
        variant: "destructive",
      });
      
      addMessage({ role: "assistant", content: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get session info for display
  const sessionInfo = getSessionInfo();

  return (
    <div className="space-y-6 h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold jato-heading bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AIVA Assistant
            </h1>
            {sessionInfo && (
              <p className="text-sm text-gray-500">
                Session active • {sessionInfo.messageCount} messages • Last activity: {sessionInfo.lastActivity.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          className="text-gray-600 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Chat
        </Button>
      </div>

      <Card className="h-full flex flex-col jato-card border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="jato-card-header bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-5 w-5" />
            Chat with your AIVA Assistant
            <span className="ml-auto text-sm opacity-75">
              {messages.length} messages
            </span>
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
                  {message.timestamp && (
                    <div className={`text-xs mt-2 opacity-70 ${
                      message.role === "user" ? "text-white/70" : "text-gray-500"
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  )}
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

          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              ref={promptInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your assets..."
              disabled={isLoading}
              className="flex-1 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-300"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !uploadedFile)}
              className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
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