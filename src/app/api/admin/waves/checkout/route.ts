import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = z.object({ wave_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu mã đợt đăng ký" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_checkout_wave", {
    p_wave_id: parsed.data.wave_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
