import { useState, useEffect, useCallback } from 'react';

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

interface ChatSession {
  messages: Message[];
  uploadedFile: UploadedFile | null;
  sessionId: string;
  lastActivity: number;
}

const CHAT_SESSION_KEY = 'aiva_chat_session';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

const defaultMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Hello! I'm your AIVA Assistant. I can help you manage your digital assets through natural language commands.\n\n✨ **What I can help you with:**\n• Create folders (I'll check for duplicates automatically)\n• List and view all your folders\n• List and search your assets\n• Upload and organize files\n• Show analytics and insights\n• Answer questions about your content\n\n💡 **Try asking me:**\n• \"Create a new folder called 'Project Photos'\"\n• \"Show me all my folders\" or \"Get list of folders\"\n• \"List of assets\" or \"I want to see all assets\"\n• \"Find assets containing 'whatsapp'\"\n• \"Upload this file to the Marketing folder\"\n• \"What's in my Documents folder?\"\n\nJust tell me what you'd like to do in your own words!",
    timestamp: Date.now(),
  },
];

export const useChatSession = () => {
  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Load chat session from localStorage on component mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const savedSession = localStorage.getItem(CHAT_SESSION_KEY);
        if (savedSession) {
          const session: ChatSession = JSON.parse(savedSession);
          
          // Check if session is still valid (not expired)
          const isExpired = Date.now() - session.lastActivity > SESSION_TIMEOUT;
          
          if (!isExpired && session.messages && session.messages.length > 0) {
            console.log('Loading existing chat session:', session.sessionId);
            setMessages(session.messages);
            setUploadedFile(session.uploadedFile);
            return;
          } else if (isExpired) {
            console.log('Chat session expired, starting fresh');
            localStorage.removeItem(CHAT_SESSION_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading chat session:', error);
        localStorage.removeItem(CHAT_SESSION_KEY);
      }
    };

    loadSession();
  }, []);

  // Save chat session to localStorage whenever messages or uploadedFile changes
  const saveSession = useCallback(() => {
    try {
      const session: ChatSession = {
        messages,
        uploadedFile,
        sessionId,
        lastActivity: Date.now(),
      };
      localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
      console.log('Chat session saved:', sessionId);
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }, [messages, uploadedFile, sessionId]);

  // Save session whenever messages or uploadedFile changes
  useEffect(() => {
    if (messages.length > 0) {
      saveSession();
    }
  }, [messages, uploadedFile, saveSession]);

  // Add a new message to the chat
  const addMessage = useCallback((message: Omit<Message, 'timestamp'>) => {
    const messageWithTimestamp: Message = {
      ...message,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, messageWithTimestamp]);
  }, []);

  // Update messages (for batch updates)
  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const updated = updater(prev);
      return updated.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || Date.now(),
      }));
    });
  }, []);

  // Clear the chat session
  const clearSession = useCallback(() => {
    setMessages(defaultMessages);
    setUploadedFile(null);
    localStorage.removeItem(CHAT_SESSION_KEY);
    console.log('Chat session cleared');
  }, []);

  // Update uploaded file
  const updateUploadedFile = useCallback((file: UploadedFile | null) => {
    setUploadedFile(file);
  }, []);

  // Get session info
  const getSessionInfo = useCallback(() => {
    const savedSession = localStorage.getItem(CHAT_SESSION_KEY);
    if (savedSession) {
      try {
        const session: ChatSession = JSON.parse(savedSession);
        return {
          sessionId: session.sessionId,
          messageCount: session.messages.length,
          lastActivity: new Date(session.lastActivity),
          hasUploadedFile: !!session.uploadedFile,
        };
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  return {
    messages,
    uploadedFile,
    sessionId,
    addMessage,
    updateMessages,
    updateUploadedFile,
    clearSession,
    getSessionInfo,
    setMessages, // Keep for backward compatibility
    setUploadedFile, // Keep for backward compatibility
  };
};