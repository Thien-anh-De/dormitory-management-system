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

export function RoomCard({
  room,
  buildingLocked,
  amenitiesMap,
  portalOpen,
  onSelect,
}: RoomCardProps) {
  const isMaintenance = room.capacity === 0;
  const isFull = room.capacity > 0 && room.current_count >= room.capacity;
  const isLocked = buildingLocked || room.is_locked;
  const isDisabled = !portalOpen || isMaintenance || isFull || isLocked;

  const progressPercent =
    room.capacity > 0
      ? Math.min(100, Math.round((room.current_count / room.capacity) * 100))
      : 0;

  const effectiveGender = room.fixed_gender ?? room.gender_type;

  const genderBadge = (() => {
    if (isMaintenance) {
      return {
        label: "Bảo trì / Kho",
        className: "bg-slate-200 text-slate-700 border-slate-300",
      };
    }
    if (effectiveGender === "MALE") {
      return {
        label: room.fixed_gender ? "Phòng Nam (Cố định)" : "Phòng Nam",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (effectiveGender === "FEMALE") {
      return {
        label: room.fixed_gender ? "Phòng Nữ (Cố định)" : "Phòng Nữ",
        className: "bg-pink-50 text-pink-700 border-pink-200",
      };
    }
    return {
      label: "Phòng Trống",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  })();

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition",
        isDisabled ? "border-slate-200 bg-slate-50/80 opacity-85" : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{room.room_code}</h3>
            <p className="text-xs text-slate-500">Tầng {room.floor}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              genderBadge.className
            )}
          >
            {genderBadge.label}
          </span>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1 text-slate-600">
              <Users className="h-3.5 w-3.5" />
              Sĩ số
            </span>
            <span
              className={cn(
                "font-bold",
                isFull ? "text-red-600" : "text-slate-900"
              )}
            >
              {room.current_count}/{room.capacity} chỗ
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isFull
                  ? "bg-red-500"
                  : progressPercent >= 75
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <p className="mt-3 text-sm font-semibold text-blue-700">
          {formatVND(room.price)}
        </p>

        {room.amenity_ids.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {room.amenity_ids.map((id) => {
              const item = amenitiesMap.get(id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {item.name}
                </span>
              );
            })}
          </div>
        )}

        {room.note && (
          <p className="mt-2 text-xs italic text-slate-500 line-clamp-2">
            {room.note}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(room)}
        className={cn(
          "mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
          isDisabled
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]"
        )}
      >
        {isMaintenance ? (
          <>
            <Wrench className="h-4 w-4" />
            Đang bảo trì
          </>
        ) : isLocked ? (
          <>
            <Lock className="h-4 w-4" />
            Đã khóa
          </>
        ) : isFull ? (
          "Đã đầy"
        ) : !portalOpen ? (
          "Chưa mở đăng ký"
        ) : (
          "Chọn phòng này"
        )}
      </button>
    </div>
  );
}
