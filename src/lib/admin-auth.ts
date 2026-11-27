import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Verify that the incoming request is authenticated as the Admin user.
 * Returns the SSR Supabase client (carrying Admin JWT so audit_logs record email) and user.
 */
export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      ),
    };
  }

  return { supabase, user, unauthorizedResponse: null };
}
