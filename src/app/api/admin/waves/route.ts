import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("registration_waves")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ waves: data });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = z.object({ name: z.string().trim().min(2).max(100) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Tên đợt đăng ký không hợp lệ" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("registration_waves")
    .insert({ name: parsed.data.name, is_active: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ wave: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      id: z.string().uuid(),
      action: z.enum(["ACTIVATE", "RENAME"]),
      name: z.string().trim().min(2).max(100).optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (parsed.data.action === "ACTIVATE") {
    const { data, error } = await supabase.rpc("activate_wave", {
      p_wave_id: parsed.data.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("registration_waves")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ wave: data });
}
