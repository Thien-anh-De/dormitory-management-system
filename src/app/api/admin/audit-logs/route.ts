import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = 25;
  const action = sp.get("action") ?? "ALL";
  const from = sp.get("from");
  const to = sp.get("to");

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (action && action !== "ALL") {
    query = query.eq("action", action);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  const start = (page - 1) * limit;
  const { data, count, error } = await query.range(start, start + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  });
}
