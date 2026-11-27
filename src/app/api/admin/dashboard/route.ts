import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAdmin();
  if (unauthorizedResponse) return unauthorizedResponse;

  const [buildingsRes, roomsRes, pendingRes, logsRes] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, code, name, is_locked, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("rooms")
      .select("id, building_id, capacity, current_count, is_locked"),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("audit_logs")
      .select("id, actor, action, target_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const buildings = buildingsRes.data ?? [];
  const rooms = roomsRes.data ?? [];
  const buildingLockedMap = new Map(buildings.map((b) => [b.id, b.is_locked]));

  let openRooms = 0;
  let lockedRooms = 0;
  let totalCapacity = 0;
  let totalOccupied = 0;

  const byBuilding = new Map<
    string,
    { capacity: number; occupied: number; rooms: number }
  >();

  for (const r of rooms) {
    const bLocked = buildingLockedMap.get(r.building_id) ?? false;
    if (r.is_locked || bLocked || r.capacity === 0) lockedRooms++;
    else openRooms++;

    totalCapacity += r.capacity;
    totalOccupied += r.current_count;

    const stat = byBuilding.get(r.building_id) ?? {
      capacity: 0,
      occupied: 0,
      rooms: 0,
    };
    stat.capacity += r.capacity;
    stat.occupied += r.current_count;
    stat.rooms += 1;
    byBuilding.set(r.building_id, stat);
  }

  const buildingStats = buildings.map((b) => {
    const st = byBuilding.get(b.id) ?? { capacity: 0, occupied: 0, rooms: 0 };
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      rooms: st.rooms,
      capacity: st.capacity,
      occupied: st.occupied,
      rate: st.capacity > 0 ? Math.round((st.occupied / st.capacity) * 100) : 0,
    };
  });

  return NextResponse.json({
    kpi: {
      totalRooms: rooms.length,
      openRooms,
      lockedRooms,
      totalCapacity,
      totalOccupied,
      occupancyRate:
        totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
      pendingCount: pendingRes.count ?? 0,
    },
    buildingStats,
    recentLogs: logsRes.data ?? [],
  });
}
