/**
 * Sprint 1 Quality Gate Test Script
 * Tests:
 * 1. Race Condition (50 concurrent register_dorm_room calls on a 6-bed room)
 * 2. RLS & Turnstile Bypass Protection (anon cannot read registrations/audit_logs or call RPCs)
 * 3. Cross-Wave Duplicate Student Constraint (active student in Wave 1 blocked in Wave 2)
 * 4. Audit Log Integrity
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars in .env.local");
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  const suffix = Date.now().toString().slice(-6);
  let buildingId = null;
  let roomId = null;
  let wave1Id = null;
  let wave2Id = null;

  console.log("=== SPRINT 1 QUALITY GATE TESTS ===");

  try {
    // Setup test fixtures
    const { data: bData, error: bErr } = await serviceClient
      .from("buildings")
      .insert({ code: `TEST_${suffix}`, name: "Test Building", is_locked: false, sort_order: 999 })
      .select()
      .single();
    if (bErr) throw bErr;
    buildingId = bData.id;

    const { data: rData, error: rErr } = await serviceClient
      .from("rooms")
      .insert({
        building_id: buildingId,
        floor: 1,
        room_code: `T101_${suffix}`,
        capacity: 6,
        current_count: 0,
        price: 500000,
        gender_type: "EMPTY",
      })
      .select()
      .single();
    if (rErr) throw rErr;
    roomId = rData.id;

    const { data: w1Data, error: w1Err } = await serviceClient
      .from("registration_waves")
      .insert({ name: `Test Wave 1 ${suffix}`, is_active: false })
      .select()
      .single();
    if (w1Err) throw w1Err;
    wave1Id = w1Data.id;

    const { data: w2Data, error: w2Err } = await serviceClient
      .from("registration_waves")
      .insert({ name: `Test Wave 2 ${suffix}`, is_active: false })
      .select()
      .single();
    if (w2Err) throw w2Err;
    wave2Id = w2Data.id;

    // Activate Wave 1 & open portal
    await serviceClient.rpc("activate_wave", { p_wave_id: wave1Id });
    await serviceClient
      .from("system_config")
      .update({ is_portal_open: true, open_at: null, close_at: null })
      .eq("id", 1);

    // ---------------------------------------------------------
    // TEST 1: Race Condition (50 concurrent requests for 6 beds)
    // ---------------------------------------------------------
    console.log("\n[1/4] Running Race Condition Test (50 concurrent requests -> 6 beds)...");
    const requests = [];
    for (let i = 0; i < 50; i++) {
      // i=0 and i=1 share same student_code to test duplicate handling; mix MALE/FEMALE
      const studentCode = i === 1 ? `SV_${suffix}_0` : `SV_${suffix}_${i}`;
      const gender = i % 2 === 0 ? "MALE" : "FEMALE";
      requests.push(
        serviceClient.rpc("register_dorm_room", {
          p_room_id: roomId,
          p_student_code: studentCode,
          p_full_name: `Student ${i}`,
          p_gender: gender,
          p_dob: "2005-01-01",
          p_extra_data: {},
        })
      );
    }

    const results = await Promise.all(requests);
    const successes = results.filter((r) => r.data?.success === true);
    const failures = results.filter((r) => r.data?.success === false);

    assert.equal(successes.length, 6, `Expected 6 successes, got ${successes.length}`);
    assert.equal(failures.length, 44, `Expected 44 failures, got ${failures.length}`);

    const { data: roomAfter } = await serviceClient
      .from("rooms")
      .select("current_count, gender_type")
      .eq("id", roomId)
      .single();

    assert.equal(roomAfter.current_count, 6, "Room current_count must be 6");

    const { data: regsInRoom } = await serviceClient
      .from("registrations")
      .select("id, student_code, gender")
      .eq("room_id", roomId)
      .in("status", ["PENDING", "APPROVED"]);

    assert.equal(regsInRoom.length, 6);
    const genders = new Set(regsInRoom.map((x) => x.gender));
    assert.equal(genders.size, 1, "All 6 students in room must have the same gender");
    assert.equal([...genders][0], roomAfter.gender_type);
    console.log("  -> PASS: Exactly 6 registrations succeeded, 100% same gender, 44 rejected cleanly.");

    // ---------------------------------------------------------
    // TEST 2: RLS & Turnstile Bypass Protection
    // ---------------------------------------------------------
    console.log("\n[2/4] Running RLS & Turnstile Bypass Protection Test...");
    const { data: anonRegs } = await anonClient.from("registrations").select("*");
    assert.equal(anonRegs?.length ?? 0, 0, "anon must NOT see any registrations");

    const { data: anonLogs } = await anonClient.from("audit_logs").select("*");
    assert.equal(anonLogs?.length ?? 0, 0, "anon must NOT see any audit_logs");

    const { error: updErr } = await anonClient
      .from("rooms")
      .update({ capacity: 99 })
      .eq("id", roomId);
    assert.ok(updErr !== null || true);
    const { data: checkCap } = await serviceClient.from("rooms").select("capacity").eq("id", roomId).single();
    assert.equal(checkCap.capacity, 6, "anon must NOT be able to update room capacity");

    const { error: rpcRegErr } = await anonClient.rpc("register_dorm_room", {
      p_room_id: roomId,
      p_student_code: `BYPASS_${suffix}`,
      p_full_name: "Bot",
      p_gender: "MALE",
      p_dob: "2005-01-01",
    });
    assert.ok(rpcRegErr !== null, "anon must NOT be able to execute register_dorm_room directly");

    const { error: rpcLookErr } = await anonClient.rpc("lookup_registration", {
      p_student_code: regsInRoom[0].student_code,
      p_dob: "2005-01-01",
    });
    assert.ok(rpcLookErr !== null, "anon must NOT be able to execute lookup_registration directly");
    console.log("  -> PASS: anon blocked from registrations, audit_logs, rooms update, and direct RPC calls.");

    // ---------------------------------------------------------
    // TEST 3: Cross-Wave Duplicate Student Constraint
    // ---------------------------------------------------------
    console.log("\n[3/4] Running Cross-Wave Duplicate Student Test...");
    const firstReg = regsInRoom[0];
    await serviceClient.rpc("admin_update_registration_status", {
      p_reg_id: firstReg.id,
      p_new_status: "APPROVED",
    });

    // Switch active wave to Wave 2 and increase room capacity so capacity isn't the blocker
    await serviceClient.rpc("activate_wave", { p_wave_id: wave2Id });
    await serviceClient.from("rooms").update({ capacity: 10 }).eq("id", roomId);

    const { data: dupRes } = await serviceClient.rpc("register_dorm_room", {
      p_room_id: roomId,
      p_student_code: firstReg.student_code,
      p_full_name: "Duplicate Cross Wave",
      p_gender: firstReg.gender,
      p_dob: "2005-01-01",
    });
    assert.equal(dupRes.success, false);
    assert.equal(dupRes.error, "DUPLICATE_STUDENT", "Approved student from Wave 1 must be blocked in Wave 2");
    console.log("  -> PASS: Active student from Wave 1 blocked from registering in Wave 2.");

    // ---------------------------------------------------------
    // TEST 4: Audit Log Verification
    // ---------------------------------------------------------
    console.log("\n[4/4] Running Audit Log Test...");
    const { data: logs } = await serviceClient
      .from("audit_logs")
      .select("action, target_id")
      .eq("target_id", firstReg.id);
    assert.ok(logs && logs.length >= 1, "audit_logs must record admin_update_registration_status");
    console.log("  -> PASS: Audit log recorded admin status update.");

    console.log("\nALL SPRINT 1 QUALITY GATE TESTS PASSED 100%!");
  } finally {
    // Cleanup test fixtures
    console.log("\nCleaning up test fixtures...");
    await serviceClient.from("system_config").update({ is_portal_open: false }).eq("id", 1);
    if (wave1Id || wave2Id) {
      await serviceClient.from("registrations").delete().in("wave_id", [wave1Id, wave2Id].filter(Boolean));
    }
    if (buildingId) {
      await serviceClient.from("buildings").delete().eq("id", buildingId);
    }
    if (wave1Id || wave2Id) {
      await serviceClient.from("registration_waves").delete().in("id", [wave1Id, wave2Id].filter(Boolean));
    }
    await serviceClient.from("audit_logs").delete().in("target_id", [wave1Id, wave2Id].filter(Boolean));
    console.log("Cleanup done.");
  }
}

runTests().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
