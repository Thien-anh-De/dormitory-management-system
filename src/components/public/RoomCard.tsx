"use client";

import { Lock, Users, Wrench } from "lucide-react";
import type { Amenity, PublicRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoomCardProps {
  room: PublicRoom;
  buildingLocked: boolean;
  amenitiesMap: Map<string, Amenity>;
  portalOpen: boolean;
  onSelect: (room: PublicRoom) => void;
}

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ/tháng";
}

export function RoomCard({ room, buildingLocked, amenitiesMap, portalOpen, onSelect }: RoomCardProps) {
  const isMaintenance = room.capacity === 0;
  const isFull        = room.capacity > 0 && room.current_count >= room.capacity;
  const isLocked      = buildingLocked || room.is_locked;
  const isDisabled    = !portalOpen || isMaintenance || isFull || isLocked;
  const pct = room.capacity > 0 ? Math.min(100, Math.round(room.current_count / room.capacity * 100)) : 0;
  const effGender = room.fixed_gender ?? room.gender_type;

  const genderConfig = (() => {
    if (isMaintenance) return { label: "Bảo trì", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" };
    if (effGender === "MALE")   return { label: "Phòng Nam", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700" };
    if (effGender === "FEMALE") return { label: "Phòng Nữ", dot: "bg-pink-500", badge: "bg-pink-50 text-pink-700" };
    return { label: "Chưa xác định", dot: "bg-green-500", badge: "bg-green-50 text-green-700" };
  })();

  const barColor = isFull ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className={cn(
      "group relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-200",
      isDisabled
        ? "border-gray-200 opacity-70"
        : "border-gray-200 hover:border-gray-900 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
    )}>
      {/* Top accent stripe */}
      <div className={cn("h-1 w-full rounded-t-2xl", isDisabled ? "bg-gray-200" : "bg-red-600")} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-black tracking-tight text-black">{room.room_code}</h3>
            <p className="text-xs font-medium text-gray-400">Tầng {room.floor}</p>
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", genderConfig.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", genderConfig.dot)} />
            {genderConfig.label}
          </span>
        </div>

        {/* Occupancy bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
              <Users className="h-3.5 w-3.5" />
              Sĩ số
            </div>
            <span className={cn("text-xs font-black", isFull ? "text-red-600" : "text-black")}>
              {room.current_count}/{room.capacity} <span className="font-medium text-gray-400">({pct}%)</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Price */}
        <p className="mt-3 text-base font-black text-black">
          {formatVND(room.price)}
        </p>

        {/* Amenity tags */}
        {room.amenity_ids.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {room.amenity_ids.map(id => {
              const item = amenitiesMap.get(id);
              if (!item) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  {item.icon && <span>{item.icon}</span>}
                  {item.name}
                </span>
              );
            })}
          </div>
        )}

        {room.note && <p className="mt-2 text-xs italic text-gray-400 line-clamp-1">{room.note}</p>}
      </div>

      {/* CTA Button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onSelect(room)}
          className={cn(
            "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all",
            isDisabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-black text-white hover:bg-red-600 shadow-sm group-hover:shadow-red-500/25 group-hover:shadow-lg"
          )}
        >
          {isMaintenance ? (<><Wrench className="h-4 w-4" />Đang bảo trì</>) :
           isLocked      ? (<><Lock className="h-4 w-4" />Đã khóa</>) :
           isFull        ? "Đã đầy chỗ" :
           !portalOpen   ? "Chưa mở đăng ký" :
           "Đăng ký phòng này →"}
        </button>
      </div>
    </div>
  );
}
