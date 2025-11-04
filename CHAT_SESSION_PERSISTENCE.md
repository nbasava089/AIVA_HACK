# AIVA Chat Session Persistence

## Overview
The AIVA chat assistant now maintains conversation history across navigation sessions. When you move to other features and return to the chat, your conversation history will be preserved.

## Features

### 🔄 **Session Persistence**
- Chat messages are automatically saved to browser localStorage
- Sessions persist for 24 hours of inactivity
- Conversation history survives page navigation and browser refreshes
- Uploaded file information is maintained in session

### 📝 **Session Information Display**
- Real-time message count display
- Last activity timestamp
- Session status indicator
- Clear visual feedback about active sessions

### 🗑️ **Manual Session Management**
- **Clear Chat** button to manually reset conversation
- Automatic session cleanup after 24 hours
- Safe handling of expired sessions

### 📎 **File Upload Persistence**
- Temporary uploaded files are remembered in session
- File attachments persist across navigation
- Automatic cleanup after successful processing

## Technical Implementation

### Session Storage
```typescript
interface ChatSession {
  messages: Message[];
  uploadedFile: UploadedFile | null;
  sessionId: string;
  lastActivity: number;
}
```

### Key Components
- `useChatSession()` - Custom hook managing session state
- `localStorage` - Browser storage for persistence
- Automatic session validation and cleanup
- Session timeout handling (24 hours)

### Session Lifecycle
1. **Session Creation**: Automatic on first chat interaction
2. **Session Updates**: Every message and file interaction
3. **Session Loading**: Automatic on component mount
4. **Session Cleanup**: Manual or automatic after timeout

## Usage

### For Users
- Simply use the chat as normal
- Your conversation will persist when you navigate away
- Use "Clear Chat" button if you want to start fresh
- Sessions automatically expire after 24 hours

### For Developers
```typescript
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
```

## Benefits
- **Improved UX**: No lost conversations when navigating
- **Better Workflow**: Users can switch between features without losing context
- **Persistent File Handling**: Uploaded files stay available across sessions
- **Smart Cleanup**: Automatic memory management with timeout

## Session Data Location
- Stored in: `localStorage` under key `aiva_chat_session`
- Format: JSON serialized `ChatSession` object
- Cleanup: Automatic on expiry or manual clear

## Troubleshooting
- If chat seems slow to load, check browser storage limits
- Clear browser localStorage if experiencing issues
- Sessions will reset if localStorage is cleared
- Check console for session-related debug information

The chat session persistence enhances the AIVA experience by maintaining conversation context across the entire user journey.