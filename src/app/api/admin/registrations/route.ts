import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const sp = request.nextUrl.searchParams;
  const waveId = sp.get("wave_id") ?? "ALL";
  const status = sp.get("status") ?? "ALL";
  const buildingId = sp.get("building_id") ?? "ALL";
  const gender = sp.get("gender") ?? "ALL";
  const q = (sp.get("q") ?? "").trim().toLowerCase();

  let query = supabase
    .from("registrations")
    .select(
      `
      id, wave_id, room_id, student_code, full_name, gender, dob, extra_data, status, reject_reason, created_at,
      rooms!inner(id, room_code, floor, capacity, current_count, building_id, buildings!inner(id, code, name)),
      registration_waves!inner(id, name)
      `
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (waveId !== "ALL") query = query.eq("wave_id", waveId);
  if (status !== "ALL") query = query.eq("status", status);
  if (gender !== "ALL") query = query.eq("gender", gender);
  if (buildingId !== "ALL") query = query.eq("rooms.building_id", buildingId);

  const [regsRes, cfgRes] = await Promise.all([
    query,
    supabase.from("system_config").select("dynamic_fields").eq("id", 1).single(),
  ]);

  if (regsRes.error) {
    return NextResponse.json({ error: regsRes.error.message }, { status: 500 });
  }

  let rows = regsRes.data ?? [];
  if (q) {
    rows = rows.filter(
      (r) =>
        r.student_code.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    registrations: rows,
    dynamic_fields: cfgRes.data?.dynamic_fields ?? [],
  });
}

const manualSchema = z.object({
  room_id: z.string().uuid(),
  wave_id: z.string().uuid(),
  student_code: z.string().trim().min(2).max(30),
  full_name: z.string().trim().min(2).max(100),
  gender: z.enum(["MALE", "FEMALE"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extra_data: z.record(z.string(), z.unknown()).optional().default({}),
  allow_override: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const { data, error } = await supabase.rpc("admin_add_student_manual", {
    p_room_id: d.room_id,
    p_wave_id: d.wave_id,
    p_student_code: d.student_code,
    p_full_name: d.full_name,
    p_gender: d.gender,
    p_dob: d.dob,
    p_extra_data: d.extra_data,
    p_allow_override: d.allow_override,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_STATUS"),
    ids: z.array(z.string().uuid()).min(1),
    status: z.enum(["APPROVED", "REJECTED", "CHECKED_OUT", "PENDING"]),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("TRANSFER"),
    reg_id: z.string().uuid(),
    target_room_id: z.string().uuid(),
    allow_override: z.boolean().optional().default(false),
  }),
]);

export async function PATCH(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (parsed.data.action === "TRANSFER") {
    const { data, error } = await supabase.rpc("admin_transfer_student", {
      p_reg_id: parsed.data.reg_id,
      p_target_room_id: parsed.data.target_room_id,
      p_allow_override: parsed.data.allow_override,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const results = [];
  for (const id of parsed.data.ids) {
    const { data, error } = await supabase.rpc("admin_update_registration_status", {
      p_reg_id: id,
      p_new_status: parsed.data.status,
      p_reason: parsed.data.reason ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    results.push(data);
  }

  return NextResponse.json({ success: true, count: results.length });
}
