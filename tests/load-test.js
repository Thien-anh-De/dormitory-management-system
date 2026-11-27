import http from "k6/http";
import { check } from "k6";

/**
 * KTX HANU Load Testing Script (k6)
 *
 * Usage:
 *   Scenario A (Read Heavy 300 req/s):
 *     k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=A tests/load-test.js
 *
 *   Scenario B (Extreme Contention - 200 VUs on 1 room):
 *     k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=B -e TARGET_ROOM_ID=<UUID> -e BYPASS_SECRET=<SECRET> tests/load-test.js
 *
 *   Scenario C (Mixed Workload - 150 read/s + 30 write/s for 3m):
 *     k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=C -e TARGET_ROOM_ID=<UUID> -e BYPASS_SECRET=<SECRET> tests/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || "https://dormitory-management-system-one.vercel.app";
const SCENARIO = (__ENV.SCENARIO || "A").toUpperCase();
const TARGET_ROOM_ID = __ENV.TARGET_ROOM_ID || "";
const BYPASS_SECRET = __ENV.BYPASS_SECRET || "";

const scenariosConfig = {};

if (SCENARIO === "A") {
  scenariosConfig.scenario_a_read_storm = {
    executor: "ramping-arrival-rate",
    startRate: 50,
    timeUnit: "1s",
    preAllocatedVUs: 100,
    maxVUs: 600,
    stages: [
      { target: 300, duration: "15s" },
      { target: 300, duration: "35s" },
      { target: 0, duration: "10s" },
    ],
    exec: "readRooms",
  };
} else if (SCENARIO === "B") {
  scenariosConfig.scenario_b_contention = {
    executor: "per-vu-iterations",
    vus: 200,
    iterations: 1,
    maxDuration: "30s",
    exec: "registerContention",
  };
} else if (SCENARIO === "C") {
  scenariosConfig.scenario_c_read = {
    executor: "ramping-arrival-rate",
    startRate: 20,
    timeUnit: "1s",
    preAllocatedVUs: 50,
    maxVUs: 300,
    stages: [
      { target: 150, duration: "30s" },
      { target: 150, duration: "2m" },
      { target: 0, duration: "30s" },
    ],
    exec: "readRooms",
  };
  scenariosConfig.scenario_c_write = {
    executor: "ramping-arrival-rate",
    startRate: 5,
    timeUnit: "1s",
    preAllocatedVUs: 20,
    maxVUs: 100,
    stages: [
      { target: 30, duration: "30s" },
      { target: 30, duration: "2m" },
      { target: 0, duration: "30s" },
    ],
    exec: "registerContention",
  };
}

export const options = {
  scenarios: scenariosConfig,
  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

export function readRooms() {
  const res = http.get(`${BASE_URL}/api/public/rooms`);
  check(res, {
    "GET rooms status 200": (r) => r.status === 200,
    "No 5xx error": (r) => r.status < 500,
  });
}

export function registerContention() {
  if (!TARGET_ROOM_ID) {
    throw new Error("TARGET_ROOM_ID is required for Scenario B / C");
  }
  const uniqueId = `K6_${__VU}_${__ITER}_${Date.now()}`;
  const payload = JSON.stringify({
    room_id: TARGET_ROOM_ID,
    student_code: uniqueId,
    full_name: `K6 Student ${__VU}`,
    gender: "MALE",
    dob: "2005-01-01",
    extra_data: { phone: "0900000000" },
  });

  const res = http.post(`${BASE_URL}/api/public/register`, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-load-test-secret": BYPASS_SECRET,
    },
  });

  check(res, {
    "Expected 201 or 409 (no 5xx)": (r) => r.status === 201 || r.status === 409,
  });
}
