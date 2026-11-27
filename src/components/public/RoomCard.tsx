"use client";

import { ArrowRight, Lock, Users, Wrench } from "lucide-react";
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

  const theme = (() => {
    if (isMaintenance) {
      return {
        label: "Bảo trì / Kho",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        accentBorder: "border-l-slate-400",
      };
    }
    if (effectiveGender === "MALE") {
      return {
        label: room.fixed_gender ? "Phòng Nam (Cố định)" : "Phòng Nam",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        accentBorder: "border-l-blue-600",
      };
    }
    if (effectiveGender === "FEMALE") {
      return {
        label: room.fixed_gender ? "Phòng Nữ (Cố định)" : "Phòng Nữ",
        badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
        accentBorder: "border-l-pink-500",
      };
    }
    return {
      label: "Phòng Trống",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      accentBorder: "border-l-emerald-500",
    };
  })();

  return (
    <div
      className={cn(
        "group flex flex-col justify-between rounded-2xl border border-slate-200/90 border-l-4 bg-white p-4 shadow-sm transition-all duration-200",
        theme.accentBorder,
        isDisabled
          ? "bg-slate-50/90 opacity-80"
          : "hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
              {room.room_code}
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Tầng {room.floor}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              theme.badgeClass
            )}
          >
            {theme.label}
          </span>
        </div>

        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Sĩ số
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "font-bold",
                  isFull ? "text-red-600" : "text-slate-900"
                )}
              >
                {room.current_count}/{room.capacity} chỗ
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                ({progressPercent}%)
              </span>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isFull
                  ? "bg-gradient-to-r from-red-500 to-rose-500"
                  : progressPercent >= 75
                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-gradient-to-r from-emerald-400 to-teal-500"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <p className="mt-3.5 text-sm font-extrabold text-indigo-700">
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
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {item.icon && <span>{item.icon}</span>}
                  {item.name}
                </span>
              );
            })}
          </div>
        )}

        {room.note && (
          <p className="mt-2.5 text-xs italic text-slate-500 line-clamp-2">
            {room.note}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(room)}
        className={cn(
          "mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
          isDisabled
            ? "cursor-not-allowed bg-slate-200/80 text-slate-500"
            : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98]"
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
          <>
            Chọn phòng này
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  );
}
