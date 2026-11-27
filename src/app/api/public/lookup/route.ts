import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getVietnameseErrorMessage } from "@/lib/error-messages";

const lookupSchema = z.object({
  student_code: z.string().trim().min(3, "Vui lòng nhập mã sinh viên").max(30),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh không đúng định dạng"),
  turnstileToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 4096) {
      return NextResponse.json(
        { found: false, message: getVietnameseErrorMessage("PAYLOAD_TOO_LARGE") },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { found: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const isHuman = await verifyTurnstileToken(parsed.data.turnstileToken);
    if (!isHuman) {
      return NextResponse.json(
        { found: false, message: getVietnameseErrorMessage("TURNSTILE_FAILED") },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("lookup_registration", {
      p_student_code: parsed.data.student_code,
      p_dob: parsed.data.dob,
    });

    if (error) {
      console.error("lookup_registration RPC error:", error);
      return NextResponse.json(
        { found: false, message: "Không thể tra cứu lúc này, vui lòng thử lại." },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("POST /api/public/lookup error:", err);
    return NextResponse.json(
      { found: false, message: "Có lỗi xảy ra, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
