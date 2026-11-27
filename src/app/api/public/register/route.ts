import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getVietnameseErrorMessage } from "@/lib/error-messages";
import type { DynamicField } from "@/lib/types";

const MAX_PAYLOAD_BYTES = 10 * 1024; // 10KB limit

const registerSchema = z.object({
  room_id: z.string().uuid("Mã phòng không hợp lệ"),
  student_code: z
    .string()
    .trim()
    .min(3, "Mã sinh viên tối thiểu 3 ký tự")
    .max(30, "Mã sinh viên tối đa 30 ký tự"),
  full_name: z
    .string()
    .trim()
    .min(2, "Họ và tên tối thiểu 2 ký tự")
    .max(100, "Họ và tên tối đa 100 ký tự"),
  gender: z.enum(["MALE", "FEMALE"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh không đúng định dạng YYYY-MM-DD"),
  extra_data: z.record(z.string(), z.unknown()).optional().default({}),
  turnstileToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "PAYLOAD_TOO_LARGE", message: getVietnameseErrorMessage("PAYLOAD_TOO_LARGE") },
        { status: 413 }
      );
    }

    const rawText = await request.text();
    if (Buffer.byteLength(rawText, "utf8") > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "PAYLOAD_TOO_LARGE", message: getVietnameseErrorMessage("PAYLOAD_TOO_LARGE") },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_INPUT", message: getVietnameseErrorMessage("INVALID_INPUT") },
        { status: 400 }
      );
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? getVietnameseErrorMessage("INVALID_INPUT"),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const bypassHeader = request.headers.get("x-load-test-secret");
    const isHuman = await verifyTurnstileToken(data.turnstileToken, bypassHeader);
    if (!isHuman) {
      return NextResponse.json(
        {
          success: false,
          error: "TURNSTILE_FAILED",
          message: getVietnameseErrorMessage("TURNSTILE_FAILED"),
        },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    // Validate dynamic_fields configured by Admin
    const { data: configData } = await supabase
      .from("system_config")
      .select("dynamic_fields")
      .eq("id", 1)
      .single();

    const dynamicFields = Array.isArray(configData?.dynamic_fields)
      ? (configData.dynamic_fields as DynamicField[])
      : [];

    const sanitizedExtra: Record<string, unknown> = {};
    for (const field of dynamicFields) {
      const val = data.extra_data?.[field.id];
      if (field.required) {
        if (field.type === "checkbox" && val !== true) {
          return NextResponse.json(
            { success: false, error: "INVALID_INPUT", message: `Vui lòng xác nhận mục "${field.label}".` },
            { status: 400 }
          );
        }
        if (field.type !== "checkbox" && (val === undefined || val === null || String(val).trim() === "")) {
          return NextResponse.json(
            { success: false, error: "INVALID_INPUT", message: `Vui lòng điền "${field.label}".` },
            { status: 400 }
          );
        }
      }
      if (val !== undefined) {
        sanitizedExtra[field.id] = val;
      }
    }

    const { data: rpcRes, error: rpcErr } = await supabase.rpc("register_dorm_room", {
      p_room_id: data.room_id,
      p_student_code: data.student_code,
      p_full_name: data.full_name,
      p_gender: data.gender,
      p_dob: data.dob,
      p_extra_data: sanitizedExtra,
    });

    if (rpcErr) {
      console.error("register_dorm_room RPC error:", rpcErr);
      return NextResponse.json(
        { success: false, error: "SERVER_ERROR", message: "Hệ thống đang bận, vui lòng thử lại." },
        { status: 500 }
      );
    }

    const result = rpcRes as {
      success: boolean;
      error?: string;
      registration_id?: string;
      room_code?: string;
      status?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: getVietnameseErrorMessage(result.error),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        registration_id: result.registration_id,
        room_code: result.room_code,
        status: result.status,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/public/register error:", err);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Có lỗi xảy ra, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
