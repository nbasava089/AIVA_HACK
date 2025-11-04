# DAM Whisper Setup Guide

## Environment Variables Setup

To fix the asset upload issue in the chat assistant, you need to configure environment variables:

### 1. Create `.env` file in the root directory with:

```
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key_here
```

### 2. Get your Supabase credentials:

1. Go to https://supabase.com/dashboard
2. Select your project (or create a new one)
3. Go to Settings → API
4. Copy the Project URL and anon/public key

### 3. Set up Supabase function environment variables:

In your Supabase dashboard, go to Edge Functions → Settings and add:
- `LOVABLE_API_KEY` - Required for AI functionality

### 4. Deploy Supabase functions:

Run these commands in your terminal:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref qbcguopecthtijtfikmv

# Deploy functions
supabase functions deploy chat-assistant

# Run migrations (if needed)
supabase db push
```

### 5. Restart the development server:

```bash
npm run dev
```

## Common Issues:

1. **"Backend not configured" error**: Missing SUPABASE_URL or SUPABASE_ANON_KEY in function environment
2. **"Not authenticated" error**: User needs to be logged in
3. **"Profile or tenant not found" error**: User profile not created or missing tenant_id
4. **"LOVABLE_API_KEY is not configured" error**: Missing API key for AI functionality

## Testing the Upload:

1. Make sure you're logged in to the application
2. Go to the Chat page
3. Click the paperclip icon to attach a file
4. Use natural language like:
   - "upload this file"
   - "save to Documents"
   - "process this asset"
   - "put this in Images folder"
   - "store this file"
   - Or just mention a folder name
5. The assistant will automatically process and upload the file