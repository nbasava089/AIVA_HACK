# File Attachment Debugging Guide

## Issue: Chat assistant not recognizing attached files

### Quick Test Steps:

1. **Open the chat page** in your browser
2. **Open browser developer tools** (F12)
3. **Go to Console tab**
4. **Attach a file** using the paperclip icon
5. **Type a message** like "upload this file to Documents folder"
6. **Send the message**
7. **Check the console logs** for debugging information

### What to Look For:

#### In Browser Console:
- Look for "Sending to chat assistant:" - this shows what data is being sent
- Look for "Chat assistant response:" - this shows the function response
- Check if `uploaded_file` object contains correct file info

#### Expected File Object:
```json
{
  "path": "tenant_id/temp/uuid.ext",
  "name": "filename.ext", 
  "type": "image/jpeg",
  "size": 12345
}
```

### Common Issues & Solutions:

#### 1. **File Not Showing in Request**
- **Symptom**: `uploaded_file: null` in console
- **Cause**: File upload to Supabase storage failed
- **Solution**: Check Supabase credentials and storage bucket setup

#### 2. **Function Not Called**
- **Symptom**: Assistant responds but doesn't mention the file
- **Solution**: Be more explicit in your request, e.g., "process the attached file" or "upload this to [folder]"

#### 3. **Missing Folder Error**
- **Symptom**: "Folder not found by name" error
- **Solution**: Create the folder first or use an existing folder name

#### 4. **Authentication Error**
- **Symptom**: "Not authenticated" or "Profile not found"
- **Solution**: Make sure you're logged in and have a complete user profile

### Test Commands:

Try these specific commands after attaching a file:

1. `"Upload this file to Documents"`
2. `"Process the attached file and put it in Images folder"`
3. `"Save this file to a new folder called Test"`

### Manual Function Test:

You can also test the function directly in browser console:

```javascript
// Test if the function responds
supabase.functions.invoke("chat-assistant", {
  body: { 
    message: "test connection",
  }
}).then(result => console.log("Function test:", result));
```

### If Still Not Working:

1. Check the SETUP_GUIDE.md for environment variables
2. Ensure Supabase functions are deployed
3. Verify user has proper permissions
4. Check Supabase storage bucket exists and is accessible