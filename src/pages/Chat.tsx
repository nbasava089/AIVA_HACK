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

      // Add user message to chat
      addMessage({ role: "user", content: displayMessage });

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
      
      if (error.message?.includes("duplicate") || error.message?.includes("already exists")) {
        errorMessage = "❌ That folder name already exists. Please try a different name.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "❌ Network error. Please check your connection and try again.";
      } else if (error.message?.includes("auth")) {
        errorMessage = "❌ Authentication error. Please refresh the page and try again.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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