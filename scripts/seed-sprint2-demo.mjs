import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  // 1. Open portal + sample announcement + 1 dynamic field
  await supabase
    .from("system_config")
    .update({
      is_portal_open: true,
      open_at: null,
      close_at: null,
      announcement: "Chào mừng sinh viên HANU! Đây là dữ liệu mẫu kiểm thử Sprint 2.",
      dynamic_fields: [
        {
          id: "phone",
          label: "Số điện thoại liên hệ",
          type: "text",
          required: true,
          placeholder: "VD: 0987654321",
        },
      ],
    })
    .eq("id", 1);

  // 2. Active wave
  const { data: existingWaves } = await supabase
    .from("registration_waves")
    .select("id")
    .eq("name", "Đợt Test Sprint 2")
    .limit(1);

  let waveId = existingWaves?.[0]?.id;
  if (!waveId) {
    const { data: w, error: wErr } = await supabase
      .from("registration_waves")
      .insert({ name: "Đợt Test Sprint 2", is_active: false })
      .select()
      .single();
    if (wErr) throw wErr;
    waveId = w.id;
  }
  await supabase.rpc("activate_wave", { p_wave_id: waveId });

  // 3. Amenities
  const { data: am1 } = await supabase
    .from("amenities")
    .upsert({ name: "Điều hòa", icon: "snowflake" }, { onConflict: "name" })
    .select()
    .single();
  const { data: am2 } = await supabase
    .from("amenities")
    .upsert({ name: "Nóng lạnh", icon: "flame" }, { onConflict: "name" })
    .select()
    .single();

  // 4. Building D10
  const { data: bld, error: bErr } = await supabase
    .from("buildings")
    .upsert({ code: "D10", name: "Nhà D10", is_locked: false, sort_order: 1 }, { onConflict: "code" })
    .select()
    .single();
  if (bErr) throw bErr;

  // 5. Three demo rooms
  const roomsPayload = [
    {
      building_id: bld.id,
      floor: 2,
      room_code: "201D10",
      capacity: 6,
      current_count: 5,
      price: 650000,
      gender_type: "MALE",
      is_locked: false,
      note: "Còn đúng 1 chỗ cuối (dùng để test tranh chấp 2 tab)",
    },
    {
      building_id: bld.id,
      floor: 2,
      room_code: "202D10",
      capacity: 6,
      current_count: 0,
      price: 650000,
      gender_type: "EMPTY",
      is_locked: false,
      note: "Phòng trống hoàn toàn",
    },
    {
      building_id: bld.id,
      floor: 3,
      room_code: "301D10",
      capacity: 4,
      current_count: 2,
      price: 800000,
      gender_type: "FEMALE",
      is_locked: false,
      note: "Phòng Nữ 4 giường",
    },
  ];

  for (const r of roomsPayload) {
    const { data: rm, error: rErr } = await supabase
      .from("rooms")
      .upsert(r, { onConflict: "room_code" })
      .select()
      .single();
    if (rErr) throw rErr;

    if (am1 && am2) {
      await supabase
        .from("room_amenities")
        .upsert(
          [
            { room_id: rm.id, amenity_id: am1.id },
            { room_id: rm.id, amenity_id: am2.id },
          ],
          { onConflict: "room_id,amenity_id" }
        );
    }
  }

  console.log("Seeded Sprint 2 demo data successfully!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
