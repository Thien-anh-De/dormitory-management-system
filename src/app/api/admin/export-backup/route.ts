import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const [buildingsRes, roomsRes, regsRes, configRes, logsRes] = await Promise.all([
    supabase.from("buildings").select("*").order("sort_order", { ascending: true }),
    supabase.from("rooms").select("*").order("room_code", { ascending: true }),
    supabase.from("registrations").select("*").order("created_at", { ascending: false }),
    supabase.from("system_config").select("*").eq("id", 1).single(),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000),
  ]);

  return NextResponse.json({
    buildings: buildingsRes.data ?? [],
    rooms: roomsRes.data ?? [],
    registrations: regsRes.data ?? [],
    config: configRes.data ?? null,
    audit_logs: logsRes.data ?? [],
  });
}
