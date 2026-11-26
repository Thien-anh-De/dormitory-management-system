import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a server-side Supabase SSR client that forwards the caller's cookies/JWT.
 * Required for Admin API routes and Server Components so audit_logs capture auth.jwt() ->> 'email'.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware handles session refresh.
          }
        },
      },
    }
  );
}
