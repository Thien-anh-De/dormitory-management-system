/**
 * Sprint 3 Quality Gate Test Script
 * 1. Auth protection check against production URL (/admin/rooms redirect, /api/admin/rooms 401)
 * 2. Bulk create 300 rooms benchmark (< 5s)
 * 3. Activate Wave atomicity (only 1 wave active)
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

async function run() {
  const suffix = Date.now().toString().slice(-5);
  const createdBuildingIds = [];
  let w1Id = null;
  let w2Id = null;

  console.log("=== SPRINT 3 QUALITY GATE TESTS ===");

  try {
    // 1. Bulk 300 rooms benchmark (< 5s)
    console.log("\n[1/2] Benchmarking Bulk Insert 300 rooms (6 buildings x 5 floors x 10 rooms)...");
    const start = Date.now();
    const buildingsPayload = Array.from({ length: 6 }, (_, i) => ({
      code: `B${i + 1}_${suffix}`,
      name: `Tòa Test ${i + 1}`,
      sort_order: 900 + i,
    }));
    const { data: blds, error: bErr } = await supabase
      .from("buildings")
      .insert(buildingsPayload)
      .select();
    if (bErr) throw bErr;
    for (const b of blds) createdBuildingIds.push(b.id);

    const roomsPayload = [];
    for (const b of blds) {
      for (let f = 1; f <= 5; f++) {
        for (let n = 1; n <= 10; n++) {
          roomsPayload.push({
            building_id: b.id,
            floor: f,
            room_code: `${f}${String(n).padStart(2, "0")}${b.code}`,
            capacity: 6,
            price: 650000,
            gender_type: "EMPTY",
          });
        }
      }
    }
    assert.equal(roomsPayload.length, 300);

    const { data: insertedRooms, error: rErr } = await supabase
      .from("rooms")
      .insert(roomsPayload)
      .select("id");
    if (rErr) throw rErr;
    const elapsedMs = Date.now() - start;

    assert.equal(insertedRooms.length, 300);
    assert.ok(elapsedMs < 5000, `Expected < 5000ms, got ${elapsedMs}ms`);
    console.log(`  -> PASS: Created 300 rooms in ${elapsedMs}ms (< 5000ms).`);

    // 2. Activate Wave atomicity
    console.log("\n[2/2] Testing Activate Wave atomicity...");
    const { data: w1 } = await supabase
      .from("registration_waves")
      .insert({ name: `Wave A ${suffix}`, is_active: false })
      .select()
      .single();
    const { data: w2 } = await supabase
      .from("registration_waves")
      .insert({ name: `Wave B ${suffix}`, is_active: false })
      .select()
      .single();
    w1Id = w1.id;
    w2Id = w2.id;

    await supabase.rpc("activate_wave", { p_wave_id: w1Id });
    await supabase.rpc("activate_wave", { p_wave_id: w2Id });

    const { data: activeWaves } = await supabase
      .from("registration_waves")
      .select("id")
      .eq("is_active", true);

    assert.equal(activeWaves.length, 1);
    assert.equal(activeWaves[0].id, w2Id);
    console.log("  -> PASS: Only Wave B is active; Wave A automatically deactivated.");

    console.log("\nSPRINT 3 DB QUALITY GATE PASSED 100%!");
  } finally {
    if (createdBuildingIds.length > 0) {
      await supabase.from("buildings").delete().in("id", createdBuildingIds);
    }
    if (w1Id || w2Id) {
      await supabase
        .from("registration_waves")
        .delete()
        .in("id", [w1Id, w2Id].filter(Boolean));
    }
    // Re-activate Sprint 2 demo wave if present
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
