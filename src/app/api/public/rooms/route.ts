import { connection, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PublicRoomsPayload } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [configRes, waveRes, buildingsRes, amenitiesRes, roomsRes, roomAmenitiesRes] =
      await Promise.all([
        supabase
          .from("system_config")
          .select("id, is_portal_open, open_at, close_at, announcement, dynamic_fields")
          .eq("id", 1)
          .single(),
        supabase
          .from("registration_waves")
          .select("id, name, is_active")
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("buildings")
          .select("id, code, name, is_locked, sort_order")
          .order("sort_order", { ascending: true })
          .order("code", { ascending: true }),
        supabase
          .from("amenities")
          .select("id, name, icon")
          .order("name", { ascending: true }),
        supabase
          .from("rooms")
          .select(
            "id, building_id, floor, room_code, capacity, current_count, price, gender_type, fixed_gender, is_locked, note"
          )
          .order("floor", { ascending: true })
          .order("room_code", { ascending: true }),
        supabase.from("room_amenities").select("room_id, amenity_id"),
      ]);

    if (configRes.error) throw configRes.error;
    if (buildingsRes.error) throw buildingsRes.error;
    if (amenitiesRes.error) throw amenitiesRes.error;
    if (roomsRes.error) throw roomsRes.error;
    if (roomAmenitiesRes.error) throw roomAmenitiesRes.error;

    const amenityMap = new Map<string, string[]>();
    for (const row of roomAmenitiesRes.data ?? []) {
      const existing = amenityMap.get(row.room_id);
      if (existing) {
        existing.push(row.amenity_id);
      } else {
        amenityMap.set(row.room_id, [row.amenity_id]);
      }
    }

    const rooms = (roomsRes.data ?? []).map((r) => ({
      ...r,
      price: Number(r.price),
      amenity_ids: amenityMap.get(r.id) ?? [],
    }));

    const payload: PublicRoomsPayload = {
      system_config: {
        ...configRes.data,
        dynamic_fields: Array.isArray(configRes.data.dynamic_fields)
          ? configRes.data.dynamic_fields
          : [],
      },
      active_wave: waveRes.data ?? null,
      buildings: buildingsRes.data ?? [],
      amenities: amenitiesRes.data ?? [],
      rooms,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=3, stale-while-revalidate=5",
      },
    });
  } catch (err) {
    console.error("GET /api/public/rooms error:", err);
    return NextResponse.json(
      { error: "Không thể tải danh sách phòng lúc này." },
      { status: 500 }
    );
  }
}
