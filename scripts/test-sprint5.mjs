/**
 * Sprint 5 Quality Gate Test Script
 * 1. State Integrity Chain (Register -> Approve -> Transfer -> Reject -> Override 7/6 -> Checkout Wave)
 * 2. 1,000-row Chunked Batch Import benchmark (< 30s)
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
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

async function verifyRoomCount(roomId) {
  const { data: room } = await supabase
    .from("rooms")
    .select("current_count, gender_type")
    .eq("id", roomId)
    .single();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .in("status", ["PENDING", "APPROVED"]);
  assert.equal(room.current_count, count, `Mismatch on room ${roomId}: current_count=${room.current_count} vs actual=${count}`);
  return room;
}

async function run() {
  const suffix = Date.now().toString().slice(-5);
  let bId = null;
  let wId = null;

  console.log("=== SPRINT 5 QUALITY GATE TESTS ===");

  try {
    const { data: bld } = await supabase
      .from("buildings")
      .insert({ code: `S5_${suffix}`, name: "Sprint 5 Building", sort_order: 999 })
      .select()
      .single();
    bId = bld.id;

    const { data: wave } = await supabase
      .from("registration_waves")
      .insert({ name: `Wave S5 ${suffix}`, is_active: false })
      .select()
      .single();
    wId = wave.id;

    await supabase.rpc("activate_wave", { p_wave_id: wId });
    await supabase
      .from("system_config")
      .update({ is_portal_open: true, open_at: null, close_at: null })
      .eq("id", 1);

    const { data: rms } = await supabase
      .from("rooms")
      .insert([
        { building_id: bId, floor: 1, room_code: `R1_${suffix}`, capacity: 6, price: 500000 },
        { building_id: bId, floor: 1, room_code: `R2_${suffix}`, capacity: 6, price: 500000 },
        { building_id: bId, floor: 1, room_code: `R3_${suffix}`, capacity: 1200, price: 500000 },
      ])
      .select();
    const r1 = rms.find((x) => x.room_code === `R1_${suffix}`);
    const r2 = rms.find((x) => x.room_code === `R2_${suffix}`);
    const r3 = rms.find((x) => x.room_code === `R3_${suffix}`);

    // ---------------------------------------------------------
    // 1. State Integrity Chain
    // ---------------------------------------------------------
    console.log("\n[1/2] Running State Integrity Chain...");
    const regM = await supabase.rpc("register_dorm_room", {
      p_room_id: r1.id,
      p_student_code: `M1_${suffix}`,
      p_full_name: "Nam 1",
      p_gender: "MALE",
      p_dob: "2005-01-01",
    });
    assert.equal(regM.data.success, true);
    let stateR1 = await verifyRoomCount(r1.id);
    assert.equal(stateR1.gender_type, "MALE");

    await supabase.rpc("admin_update_registration_status", {
      p_reg_id: regM.data.registration_id,
      p_new_status: "APPROVED",
    });
    await verifyRoomCount(r1.id);

    await supabase.rpc("admin_transfer_student", {
      p_reg_id: regM.data.registration_id,
      p_target_room_id: r2.id,
      p_allow_override: false,
    });
    stateR1 = await verifyRoomCount(r1.id);
    const stateR2 = await verifyRoomCount(r2.id);
    assert.equal(stateR1.current_count, 0);
    assert.equal(stateR1.gender_type, "EMPTY");
    assert.equal(stateR2.current_count, 1);
    assert.equal(stateR2.gender_type, "MALE");

    const regF = await supabase.rpc("register_dorm_room", {
      p_room_id: r1.id,
      p_student_code: `F1_${suffix}`,
      p_full_name: "Nu 1",
      p_gender: "FEMALE",
      p_dob: "2005-02-02",
    });
    assert.equal(regF.data.success, true);
    stateR1 = await verifyRoomCount(r1.id);
    assert.equal(stateR1.gender_type, "FEMALE");

    await supabase.rpc("admin_update_registration_status", {
      p_reg_id: regF.data.registration_id,
      p_new_status: "REJECTED",
      p_reason: "Test reject",
    });
    stateR1 = await verifyRoomCount(r1.id);
    assert.equal(stateR1.current_count, 0);
    assert.equal(stateR1.gender_type, "EMPTY");

    // Fill 6 + 1 override = 7/6
    for (let i = 1; i <= 7; i++) {
      const ov = await supabase.rpc("admin_add_student_manual", {
        p_room_id: r1.id,
        p_wave_id: wId,
        p_student_code: `OV_${suffix}_${i}`,
        p_full_name: `Override ${i}`,
        p_gender: "MALE",
        p_dob: "2005-03-03",
        p_allow_override: i === 7,
      });
      assert.equal(ov.data.success, true);
    }
    stateR1 = await verifyRoomCount(r1.id);
    assert.equal(stateR1.current_count, 7);

    // Checkout wave -> back to 0
    const chk = await supabase.rpc("admin_checkout_wave", { p_wave_id: wId });
    assert.equal(chk.data.success, true);
    stateR1 = await verifyRoomCount(r1.id);
    assert.equal(stateR1.current_count, 0);
    assert.equal(stateR1.gender_type, "EMPTY");
    console.log("  -> PASS: All state transitions, override 7/6, and wave checkout matched 100%.");

    // ---------------------------------------------------------
    // 2. 1,000-row Chunked Batch Import (< 30s)
    // ---------------------------------------------------------
    console.log("\n[2/2] Running 1,000-row Chunked Batch Import (10 batches x 100)...");
    const t0 = Date.now();
    let totalImported = 0;
    for (let b = 0; b < 10; b++) {
      const records = Array.from({ length: 100 }, (_, idx) => ({
        wave_id: wId,
        room_code: r3.room_code,
        student_code: `IMP_${suffix}_${b}_${idx}`,
        full_name: `Import SV ${b}-${idx}`,
        gender: "MALE",
        dob: "2005-05-05",
        extra_data: { phone: "0900000000" },
      }));
      const imp = await supabase.rpc("batch_import_students", { p_records: records });
      assert.equal(imp.data.success, true);
      totalImported += imp.data.success_count;
    }
    const elapsed = Date.now() - t0;
    assert.equal(totalImported, 1000);
    assert.ok(elapsed < 30000, `Expected < 30000ms, got ${elapsed}ms`);
    const stateR3 = await verifyRoomCount(r3.id);
    assert.equal(stateR3.current_count, 1000);
    console.log(`  -> PASS: Imported 1,000 students in ${elapsed}ms (< 30,000ms) and synced count=1000.`);

    console.log("\nSPRINT 5 QUALITY GATE PASSED 100%!");
  } finally {
    if (wId) {
      await supabase.from("registrations").delete().eq("wave_id", wId);
    }
    if (bId) {
      await supabase.from("buildings").delete().eq("id", bId);
    }
    if (wId) {
      await supabase.from("registration_waves").delete().eq("id", wId);
    }
    const { data: demoWave } = await supabase
      .from("registration_waves")
      .select("id")
      .eq("name", "Đợt Test Sprint 2")
      .maybeSingle();
    if (demoWave) {
      await supabase.rpc("activate_wave", { p_wave_id: demoWave.id });
    }
  }
}

run().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
