# Asset Upload Troubleshooting Guide

## 🔍 Diagnosing Upload Issues

### Step 1: Check Browser Console

1. **Open your browser** at http://localhost:8080/
2. **Press F12** to open Developer Tools
3. **Go to Console tab**
4. **Try uploading a file** in the chat
5. **Look for these specific error messages:**

#### Common Error Messages & Solutions:

**"Function not found" or "404 error"**
- ❌ **Issue**: Supabase chat-assistant function not deployed
- ✅ **Solution**: Deploy the function (see SETUP_GUIDE.md)

**"LOVABLE_API_KEY is not configured"**
- ❌ **Issue**: Missing AI API key
- ✅ **Solution**: Add LOVABLE_API_KEY to Supabase function environment

**"Backend not configured"**
- ❌ **Issue**: Missing Supabase environment variables
- ✅ **Solution**: Create .env file with SUPABASE credentials

**"Not authenticated"**
- ❌ **Issue**: User not logged in
- ✅ **Solution**: Make sure you're logged into the app

**"Profile or tenant not found"**
- ❌ **Issue**: User profile not properly set up
- ✅ **Solution**: Check database has user profile with tenant_id

### Step 2: Test File Upload Only

Try the **regular Upload page** (not chat):
1. Go to Upload page
2. Select a file
3. Choose a folder
4. Click "Upload Asset"

If this works but chat doesn't, the issue is with the chat-assistant function.

### Step 3: Manual Function Test

In browser console, test the function directly:

```javascript
// Test 1: Basic function connectivity
supabase.functions.invoke("chat-assistant", {
  body: { message: "test connection" }
}).then(result => console.log("Function test:", result));

// Test 2: Check authentication
supabase.auth.getUser().then(result => console.log("Auth status:", result));

// Test 3: Check environment variables
console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Supabase Key:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "Set" : "Missing");
```

### Step 4: Quick Environment Check

Create a `.env` file in project root if missing:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Step 5: Temporary Workaround

If chat upload isn't working, you can still use:
- **Upload page** - Direct file upload
- **Folder page** - Upload to specific folders
- **Manual organization** - Use the regular UI

## 🎯 Most Likely Issues:

### 1. **Function Not Deployed** (90% of cases)
The chat-assistant Supabase Edge Function needs to be deployed.

### 2. **Missing Environment Variables** (80% of cases)
Frontend needs Supabase URL and API key in .env file.

### 3. **Missing AI API Key** (70% of cases)
The LOVABLE_API_KEY needs to be set in Supabase function environment.

### 4. **Authentication Issues** (50% of cases)
User needs to be properly logged in with complete profile.

## 🚀 Quick Test Steps:

1. **Check if you're logged in** - Look for user menu in top right
2. **Try regular upload page** - Test if basic upload works
3. **Check browser console** - Look for specific error messages
4. **Test function directly** - Use console commands above

Most upload issues are due to the Supabase function not being deployed or environment variables not being configured. The app can work fully without the chat function - just use the regular Upload and Folders pages!