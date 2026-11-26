import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a browser Supabase client using the public anon key.
 * Used for client-side Admin auth and public read queries.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
