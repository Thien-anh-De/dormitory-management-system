import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const dynamicFieldSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "number", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

const patchSchema = z.object({
  is_portal_open: z.boolean(),
  open_at: z.string().nullable(),
  close_at: z.string().nullable(),
  announcement: z.string().max(2000),
  dynamic_fields: z.array(dynamicFieldSchema),
});

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("system_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu cấu hình không hợp lệ" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("system_config")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const serviceClient = createServiceRoleClient();
  await serviceClient.from("audit_logs").insert({
    actor: user.email ?? "ADMIN",
    action: "UPDATE_SYSTEM_CONFIG",
    target_type: "system_config",
    details: {
      is_portal_open: parsed.data.is_portal_open,
      open_at: parsed.data.open_at,
      close_at: parsed.data.close_at,
      fields_count: parsed.data.dynamic_fields.length,
    },
  });

  return NextResponse.json({ config: data });
}
