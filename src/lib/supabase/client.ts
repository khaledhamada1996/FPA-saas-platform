import { createClient } from "@supabase/supabase-js";

// Public Supabase configuration for the FPA SaaS project.
// Environment variables remain the preferred production configuration.
// The publishable key is safe for browser use; never use a secret/service-role key here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qnoulgkttxvnqdiisevv.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_1VEncF0WwxH9JqeAeGWBrg_EiwCBQ9X";

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase client configuration is unavailable");
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}
