import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const batchSchema = z.object({
  records: z
    .array(
      z.object({
        wave_id: z.string().uuid(),
        room_code: z.string().trim().min(1),
        student_code: z.string().trim().min(1),
        full_name: z.string().trim().min(1),
        gender: z.enum(["MALE", "FEMALE"]),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        extra_data: z.record(z.string(), z.unknown()).optional().default({}),
      })
    )
    .min(1)
    .max(100),
});

export async function POST(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu batch import không hợp lệ" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("batch_import_students", {
    p_records: parsed.data.records,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
