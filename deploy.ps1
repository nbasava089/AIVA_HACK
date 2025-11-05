# AIVA Deployment Script for Windows
Write-Host "=== AIVA Deployment Script ===" -ForegroundColor Green
Write-Host "Deploying with Google API integration..." -ForegroundColor Yellow

# Check if Supabase CLI is installed
try {
    supabase --version | Out-Null
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
}
catch {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Red
    npm install -g supabase
}

# Login to Supabase (if not already logged in)
Write-Host "🔐 Checking Supabase authentication..." -ForegroundColor Cyan
try {
    supabase status | Out-Null
}
catch {
    Write-Host "Please login to Supabase..." -ForegroundColor Yellow
    supabase login
}

# Link to project
Write-Host "🔗 Linking to Supabase project..." -ForegroundColor Cyan
supabase link --project-ref qbcguopecthtijtfikmv

# Deploy all functions
Write-Host "🚀 Deploying Supabase functions..." -ForegroundColor Cyan
Write-Host "Deploying chat-assistant..." -ForegroundColor Gray
supabase functions deploy chat-assistant

Write-Host "Deploying generate-embedding..." -ForegroundColor Gray
supabase functions deploy generate-embedding

Write-Host "Deploying verify-content..." -ForegroundColor Gray
supabase functions deploy verify-content

Write-Host "Deploying backfill-embeddings..." -ForegroundColor Gray
supabase functions deploy backfill-embeddings

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Yellow
Write-Host "1. Set GOOGLE_API_KEY in Supabase Dashboard:" -ForegroundColor White
Write-Host "   → https://supabase.com/dashboard/project/qbcguopecthtijtfikmv" -ForegroundColor Cyan
Write-Host "   → Edge Functions → Settings" -ForegroundColor Cyan
Write-Host "   → Add: GOOGLE_API_KEY = AIzaSyAa81m8FY8MVaTIMksYwrTn5aUnfwrSyQI" -ForegroundColor Green
Write-Host ""
Write-Host "2. Create .env file with frontend variables:" -ForegroundColor White
Write-Host "   VITE_SUPABASE_URL=your_supabase_url" -ForegroundColor Cyan
Write-Host "   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Start development server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Green