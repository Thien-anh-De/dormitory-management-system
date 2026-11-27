import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { id } = await context.params;

  const [roomRes, studentsRes] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", id).single(),
    supabase
      .from("registrations")
      .select("id, student_code, full_name, gender, dob, status, created_at, wave_id")
      .eq("room_id", id)
      .in("status", ["PENDING", "APPROVED"])
      .order("created_at", { ascending: true }),
  ]);

  if (roomRes.error) {
    return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
  }

  return NextResponse.json({
    room: roomRes.data,
    students: studentsRes.data ?? [],
  });
}
