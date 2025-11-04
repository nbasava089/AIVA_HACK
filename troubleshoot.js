// Troubleshooting script for DAM Whisper Chat Assistant
// Run this in your browser console on the chat page to diagnose issues

console.log("=== DAM Whisper Troubleshooting ===");

// Check environment variables
console.log("1. Environment Variables:");
console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL ? "✓ Set" : "✗ Missing");
console.log("VITE_SUPABASE_PUBLISHABLE_KEY:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "✓ Set" : "✗ Missing");

// Check Supabase client
import { supabase } from './src/integrations/supabase/client';

// Test authentication
supabase.auth.getUser().then(({ data, error }) => {
  console.log("2. Authentication:");
  if (error) {
    console.log("Auth Error:", error.message);
  } else if (data.user) {
    console.log("✓ User authenticated:", data.user.email);
    
    // Check user profile
    supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", data.user.id)
      .single()
      .then(({ data: profile, error: profileErr }) => {
        console.log("3. User Profile:");
        if (profileErr) {
          console.log("✗ Profile Error:", profileErr.message);
        } else if (profile?.tenant_id) {
          console.log("✓ Profile found with tenant:", profile.tenant_id);
        } else {
          console.log("✗ No tenant_id found in profile");
        }
      });
  } else {
    console.log("✗ User not authenticated");
  }
});

// Test function connectivity
supabase.functions.invoke("chat-assistant", {
  body: { message: "test" }
}).then(({ data, error }) => {
  console.log("4. Function Test:");
  if (error) {
    console.log("✗ Function Error:", error.message);
  } else {
    console.log("✓ Function responsive:", data);
  }
});

console.log("=== Check completed ===");