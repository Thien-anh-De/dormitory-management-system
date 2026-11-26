import { createClient } from "@supabase/supabase-js";

/**
 * Create a privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * ONLY import in server-side API routes (e.g., /api/public/register, /api/public/lookup)
 * after verifying Cloudflare Turnstile. Never expose to client code.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
