#!/bin/bash

echo "=== AIVA Deployment Script ==="
echo "Deploying with Google API integration..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if not already logged in)
echo "🔐 Checking Supabase authentication..."
supabase status > /dev/null 2>&1 || supabase login

# Link to project
echo "🔗 Linking to Supabase project..."
supabase link --project-ref qbcguopecthtijtfikmv

# Deploy all functions
echo "🚀 Deploying Supabase functions..."
supabase functions deploy chat-assistant
supabase functions deploy generate-embedding
supabase functions deploy verify-content
supabase functions deploy backfill-embeddings

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Set GOOGLE_API_KEY in Supabase Dashboard:"
echo "   → https://supabase.com/dashboard/project/qbcguopecthtijtfikmv"
echo "   → Edge Functions → Settings"
echo "   → Add: GOOGLE_API_KEY = AIzaSyAa81m8FY8MVaTIMksYwrTn5aUnfwrSyQI"
echo ""
echo "2. Create .env file with frontend variables:"
echo "   VITE_SUPABASE_URL=your_supabase_url"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key"
echo ""
echo "3. Start development server:"
echo "   npm run dev"