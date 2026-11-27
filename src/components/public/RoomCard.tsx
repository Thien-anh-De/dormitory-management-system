"use client";

import { ArrowRight, BedDouble, Lock, Users, Wrench } from "lucide-react";
import type { Amenity, PublicRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoomCardProps {
  room: PublicRoom;
  buildingLocked: boolean;
  amenitiesMap: Map<string, Amenity>;
  portalOpen: boolean;
  onSelect: (room: PublicRoom) => void;
}

function formatPriceNumber(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export function RoomCard({ room, buildingLocked, amenitiesMap, portalOpen, onSelect }: RoomCardProps) {
  const isMaintenance = room.capacity === 0;
  const isFull        = room.capacity > 0 && room.current_count >= room.capacity;
  const isLocked      = buildingLocked || room.is_locked;
  const isDisabled    = !portalOpen || isMaintenance || isFull || isLocked;
  const freeBeds      = Math.max(0, room.capacity - room.current_count);
  const pct           = room.capacity > 0 ? Math.min(100, Math.round((room.current_count / room.capacity) * 100)) : 0;
  const effGender     = room.fixed_gender ?? room.gender_type;

  const genderConfig = (() => {
    if (isMaintenance) return { label: "Bảo trì", dot: "bg-stone-400", badge: "bg-stone-100 text-stone-700 border-stone-200" };
    if (effGender === "MALE") return { label: "Phòng Nam", dot: "bg-sky-600", badge: "bg-sky-50 text-sky-800 border-sky-200" };
    if (effGender === "FEMALE") return { label: "Phòng Nữ", dot: "bg-rose-600", badge: "bg-rose-50 text-rose-800 border-rose-200" };
    return { label: "Chưa gán giới tính", dot: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  })();

  const showBedMatrix = room.capacity > 0 && room.capacity <= 12;

  return (
    <div
      onClick={() => !isDisabled && onSelect(room)}
      className={cn(
        "group relative flex flex-col justify-between rounded-3xl border bg-white p-5 transition-all duration-200",
        isDisabled
          ? "border-black/8 bg-white/75 opacity-75"
          : "border-black/10 shadow-sm hover:-translate-y-1 hover:border-[#c8102e]/50 hover:shadow-xl hover:shadow-red-950/10 cursor-pointer"
      )}
    >
      <div>
        {/* Top Row: Room Code + Gender Pill */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-2xl font-extrabold tracking-tight text-[#111114]">
                {room.room_code}
              </h3>
              {!isDisabled && freeBeds <= 2 && freeBeds > 0 && (
                <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-extrabold text-[#c8102e]">
                  Còn {freeBeds} chỗ
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-stone-500">
              Tầng {room.floor}
            </p>
          </div>

          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-bold shrink-0", genderConfig.badge)}>
            <span className={cn("h-2 w-2 rounded-full", genderConfig.dot)} />
            {genderConfig.label}
          </span>
        </div>

        {/* Visual Bed-Slot Matrix Box */}
        <div className="mt-4 rounded-2xl bg-[#f6f5f2] p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-700">
              <Users className="h-4 w-4 text-stone-500" />
              {isMaintenance
                ? "Ngừng tiếp nhận"
                : isLocked
                ? "Phòng đang khóa"
                : isFull
                ? "Đã đủ sinh viên"
                : `Còn ${freeBeds} giường trống`}
            </span>
            <span className={cn("font-mono text-[15px] font-extrabold tabular-nums", isFull ? "text-[#c8102e]" : "text-[#111114]")}>
              {room.current_count}/{room.capacity}
            </span>
          </div>

          {showBedMatrix ? (
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(room.capacity, 6)}, minmax(0, 1fr))` }}
              aria-label={`${room.current_count} trên ${room.capacity} giường đã có người`}
            >
              {Array.from({ length: room.capacity }).map((_, idx) => {
                const occupied = idx < room.current_count;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-lg border text-xs font-bold transition",
                      occupied
                        ? isFull
                          ? "border-red-300 bg-red-600 text-white"
                          : "border-stone-800 bg-[#111114] text-white"
                        : isDisabled
                        ? "border-stone-300 bg-white/60 text-stone-400"
                        : "border-dashed border-emerald-500 bg-emerald-50 text-emerald-700"
                    )}
                    title={occupied ? "Đã có sinh viên" : "Giường trống"}
                  >
                    <BedDouble className="h-3.5 w-3.5" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isFull ? "bg-[#c8102e]" : pct >= 75 ? "bg-amber-500" : "bg-emerald-600"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Price Block */}
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[#111114] tabular-nums">
              {formatPriceNumber(room.price)} đ
            </span>
            <span className="ml-1 text-sm font-medium text-stone-500">/ tháng</span>
          </div>
          <span className="text-xs font-bold text-stone-400 tabular-nums">{pct}% lấp đầy</span>
        </div>

        {/* Amenity chips */}
        {room.amenity_ids.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {room.amenity_ids.map(id => {
              const item = amenitiesMap.get(id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-xl border border-black/8 bg-[#f6f5f2] px-2.5 py-1 text-[13px] font-semibold text-stone-700"
                >
                  {item.icon && <span>{item.icon}</span>}
                  {item.name}
                </span>
              );
            })}
          </div>
        )}

        {room.note && (
          <p className="mt-2.5 text-sm italic text-stone-500 line-clamp-2">{room.note}</p>
        )}
      </div>

      {/* CTA Button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(room);
        }}
        className={cn(
          "mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-extrabold transition-all",
          isDisabled
            ? "bg-stone-200/80 text-stone-500 cursor-not-allowed"
            : "bg-[#111114] text-white group-hover:bg-[#c8102e] group-hover:shadow-lg group-hover:shadow-red-600/25"
        )}
      >
        {isMaintenance ? (
          <><Wrench className="h-4 w-4" /> Đang bảo trì</>
        ) : isLocked ? (
          <><Lock className="h-4 w-4" /> Phòng đã khóa</>
        ) : isFull ? (
          "Đã đầy chỗ"
        ) : !portalOpen ? (
          "Chưa mở đăng ký"
        ) : (
          <>
            <span>Chọn phòng này</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </div>
  );
}
