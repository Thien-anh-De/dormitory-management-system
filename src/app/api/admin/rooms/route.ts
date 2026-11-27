import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const bulkCreateSchema = z.object({
  rooms: z
    .array(
      z.object({
        building_id: z.string().uuid(),
        floor: z.number().int().min(0).max(99),
        room_code: z.string().trim().min(1).max(30),
        capacity: z.number().int().min(0).max(50),
        price: z.number().min(0),
        fixed_gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
        note: z.string().optional().default(""),
      })
    )
    .min(1)
    .max(500),
  amenity_ids: z.array(z.string().uuid()).optional().default([]),
  skip_existing: z.boolean().optional().default(true),
});

const bulkPatchSchema = z.object({
  room_ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    is_locked: z.boolean().optional(),
    capacity: z.number().int().min(0).max(50).optional(),
    price: z.number().min(0).optional(),
    fixed_gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
    note: z.string().optional(),
  }),
  set_amenity_ids: z.array(z.string().uuid()).optional(),
  add_amenity_ids: z.array(z.string().uuid()).optional(),
  remove_amenity_ids: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const [buildingsRes, amenitiesRes, roomsRes, roomAmenitiesRes] = await Promise.all([
    supabase
      .from("buildings")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    supabase.from("amenities").select("*").order("name", { ascending: true }),
    supabase
      .from("rooms")
      .select("*")
      .order("floor", { ascending: true })
      .order("room_code", { ascending: true }),
    supabase.from("room_amenities").select("room_id, amenity_id"),
  ]);

  if (roomsRes.error) {
    return NextResponse.json({ error: roomsRes.error.message }, { status: 500 });
  }

  const amMap = new Map<string, string[]>();
  for (const row of roomAmenitiesRes.data ?? []) {
    const arr = amMap.get(row.room_id) ?? [];
    arr.push(row.amenity_id);
    amMap.set(row.room_id, arr);
  }

  const rooms = (roomsRes.data ?? []).map((r) => ({
    ...r,
    price: Number(r.price),
    amenity_ids: amMap.get(r.id) ?? [],
  }));

  return NextResponse.json({
    buildings: buildingsRes.data ?? [],
    amenities: amenitiesRes.data ?? [],
    rooms,
  });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = bulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu tạo phòng không hợp lệ" },
      { status: 400 }
    );
  }

  const rows = parsed.data.rooms.map((r) => ({
    building_id: r.building_id,
    floor: r.floor,
    room_code: r.room_code,
    capacity: r.capacity,
    price: r.price,
    fixed_gender: r.fixed_gender ?? null,
    gender_type: r.fixed_gender ?? "EMPTY",
    note: r.note ?? "",
  }));

  const query = parsed.data.skip_existing
    ? supabase
        .from("rooms")
        .upsert(rows, { onConflict: "room_code", ignoreDuplicates: true })
        .select("id, room_code")
    : supabase.from("rooms").insert(rows).select("id, room_code");

  const { data: insertedRooms, error } = await query;

  if (error) {
    const msg =
      error.code === "23505"
        ? "Một hoặc nhiều mã phòng đã tồn tại trong hệ thống. Vui lòng kiểm tra lại."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (parsed.data.amenity_ids.length > 0 && insertedRooms && insertedRooms.length > 0) {
    const raRows: { room_id: string; amenity_id: string }[] = [];
    for (const rm of insertedRooms) {
      for (const amId of parsed.data.amenity_ids) {
        raRows.push({ room_id: rm.id, amenity_id: amId });
      }
    }
    const { error: raErr } = await supabase.from("room_amenities").insert(raRows);
    if (raErr) {
      return NextResponse.json({ error: raErr.message }, { status: 400 });
    }
  }

  return NextResponse.json(
    { success: true, count: insertedRooms?.length ?? 0 },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = bulkPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ" }, { status: 400 });
  }

  const { room_ids, updates, set_amenity_ids, add_amenity_ids, remove_amenity_ids } =
    parsed.data;

  const updatePayload: Record<string, unknown> = { ...updates };
  if ("fixed_gender" in updates && updates.fixed_gender) {
    updatePayload.gender_type = updates.fixed_gender;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("rooms")
      .update(updatePayload)
      .in("id", room_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if ("fixed_gender" in updates && updates.fixed_gender === null) {
      await supabase.rpc("recalculate_room_counts");
    }
  }

  if (set_amenity_ids) {
    await supabase.from("room_amenities").delete().in("room_id", room_ids);
    if (set_amenity_ids.length > 0) {
      const raRows = room_ids.flatMap((rid) =>
        set_amenity_ids.map((aid) => ({ room_id: rid, amenity_id: aid }))
      );
      await supabase.from("room_amenities").insert(raRows);
    }
  }

  if (add_amenity_ids && add_amenity_ids.length > 0) {
    const raRows = room_ids.flatMap((rid) =>
      add_amenity_ids.map((aid) => ({ room_id: rid, amenity_id: aid }))
    );
    await supabase
      .from("room_amenities")
      .upsert(raRows, { onConflict: "room_id,amenity_id" });
  }

  if (remove_amenity_ids && remove_amenity_ids.length > 0) {
    await supabase
      .from("room_amenities")
      .delete()
      .in("room_id", room_ids)
      .in("amenity_id", remove_amenity_ids);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
