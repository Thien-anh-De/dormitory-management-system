"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { Building, DynamicField, Gender, PublicRoom } from "@/lib/types";
import { ExcelImportModal } from "@/components/admin/ExcelImportModal";
import {
  exportFullBackupWorkbook,
  exportPoliceTemporaryResidence,
  exportStudentsByRoom,
  type ExportRegistrationRow,
} from "@/lib/excel-export";

interface Wave {
  id: string;
  name: string;
  is_active: boolean;
}

const STATUS_LABEL: Record<string, { text: string; cls: string; dot: string }> = {
  PENDING: {
    text: "Chờ duyệt",
    cls: "bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
  },
  APPROVED: {
    text: "Đã duyệt",
    cls: "bg-emerald-100 text-emerald-900",
    dot: "bg-emerald-600",
  },
  REJECTED: {
    text: "Từ chối",
    cls: "bg-red-100 text-red-900",
    dot: "bg-[#c8102e]",
  },
  CHECKED_OUT: {
    text: "Đã trả phòng",
    cls: "bg-stone-200 text-stone-700",
    dot: "bg-stone-500",
  },
};

export default function AdminRegistrationsPage() {
  const [regs, setRegs] = useState<ExportRegistrationRow[]>([]);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [waveFilter, setWaveFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [buildingFilter, setBuildingFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [transferReg, setTransferReg] = useState<ExportRegistrationRow | null>(null);
  const [rejectRegId, setRejectRegId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailReg, setDetailReg] = useState<ExportRegistrationRow | null>(null);

  // Manual form
  const [mWaveId, setMWaveId] = useState("");
  const [mRoomId, setMRoomId] = useState("");
  const [mCode, setMCode] = useState("");
  const [mName, setMName] = useState("");
  const [mGender, setMGender] = useState<Gender>("MALE");
  const [mDob, setMDob] = useState("");
  const [mOverride, setMOverride] = useState(false);

  // Transfer form
  const [tRoomId, setTRoomId] = useState("");
  const [tOverride, setTOverride] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      wave_id: waveFilter,
      status: statusFilter,
      building_id: buildingFilter,
      gender: genderFilter,
      q: searchQ,
    });

    const [regRes, roomRes, waveRes] = await Promise.all([
      fetch(`/api/admin/registrations?${params.toString()}`),
      fetch("/api/admin/rooms"),
      fetch("/api/admin/waves"),
    ]);

    if (regRes.ok) {
      const rj = await regRes.json();
      setRegs(rj.registrations ?? []);
      setDynamicFields(rj.dynamic_fields ?? []);
    }
    if (roomRes.ok) {
      const rmj = await roomRes.json();
      setBuildings(rmj.buildings ?? []);
      setRooms(rmj.rooms ?? []);
      if (!mRoomId && rmj.rooms?.[0]) setMRoomId(rmj.rooms[0].id);
    }
    if (waveRes.ok) {
      const wj = await waveRes.json();
      setWaves(wj.waves ?? []);
      if (!mWaveId && wj.waves?.[0]) setMWaveId(wj.waves[0].id);
    }
    setLoading(false);
  }, [waveFilter, statusFilter, buildingFilter, genderFilter, searchQ, mRoomId, mWaveId]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      wave_id: waveFilter,
      status: statusFilter,
      building_id: buildingFilter,
      gender: genderFilter,
      q: searchQ,
    });

    Promise.all([
      fetch(`/api/admin/registrations?${params.toString()}`),
      fetch("/api/admin/rooms"),
      fetch("/api/admin/waves"),
    ])
      .then(async ([regRes, roomRes, waveRes]) => {
        if (!active) return;
        if (regRes.ok) {
          const rj = await regRes.json();
          if (active) {
            setRegs(rj.registrations ?? []);
            setDynamicFields(rj.dynamic_fields ?? []);
          }
        }
        if (roomRes.ok) {
          const rmj = await roomRes.json();
          if (active) {
            setBuildings(rmj.buildings ?? []);
            setRooms(rmj.rooms ?? []);
            setMRoomId(prev => prev || rmj.rooms?.[0]?.id || "");
          }
        }
        if (waveRes.ok) {
          const wj = await waveRes.json();
          if (active) {
            setWaves(wj.waves ?? []);
            setMWaveId(prev => prev || wj.waves?.[0]?.id || "");
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [waveFilter, statusFilter, buildingFilter, genderFilter, searchQ]);

  async function updateStatus(ids: string[], status: string, reason?: string) {
    await fetch("/api/admin/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_STATUS", ids, status, reason }),
    });
    setSelectedIds(new Set());
    await loadAll();
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mOverride && !confirm("Xác nhận xếp sinh viên VƯỢT SỨC CHỨA / GHI ĐÈ?")) return;
    const res = await fetch("/api/admin/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wave_id: mWaveId,
        room_id: mRoomId,
        student_code: mCode,
        full_name: mName,
        gender: mGender,
        dob: mDob,
        allow_override: mOverride,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.success === false) {
      alert(j.error ?? "Không thể thêm sinh viên.");
      return;
    }
    setShowManual(false);
    setMCode("");
    setMName("");
    await loadAll();
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferReg || !tRoomId) return;
    const dst = rooms.find(r => r.id === tRoomId);
    if (dst && dst.gender_type !== "EMPTY" && dst.gender_type !== transferReg.gender) {
      if (
        !confirm(
          `CẢNH BÁO: Bạn đang chuyển SV ${transferReg.gender === "MALE" ? "Nam" : "Nữ"} sang phòng ${
            dst.room_code
          } (${dst.gender_type === "MALE" ? "Nam" : "Nữ"}). Xác nhận?`
        )
      ) {
        return;
      }
    }

    const res = await fetch("/api/admin/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TRANSFER",
        reg_id: transferReg.id,
        target_room_id: tRoomId,
        allow_override: tOverride,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.success === false) {
      alert(j.error ?? "Không thể chuyển phòng.");
      return;
    }
    setTransferReg(null);
    await loadAll();
  }

  async function handleFullBackup() {
    const res = await fetch("/api/admin/export-backup");
    if (!res.ok) return;
    const data = await res.json();
    exportFullBackupWorkbook(data);
  }

  const inputClass =
    "min-h-[46px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-4 text-[15px] font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
            Xét duyệt Đơn & Quản lý Lưu trú ({regs.length})
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Duyệt đơn, từ chối, chuyển phòng, nhập SV khóa cũ và xuất báo cáo Excel chuẩn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#c8102e] px-4 text-sm font-extrabold text-white shadow-md shadow-red-600/20 hover:bg-[#a50d26] transition"
          >
            <Plus className="h-4 w-4" /> Thêm SV thủ công
          </button>

          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border-2 border-emerald-600 bg-white px-4 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50 transition"
          >
            <FileSpreadsheet className="h-4 w-4" /> Import Excel
          </button>

          <button
            type="button"
            onClick={() => exportStudentsByRoom(regs, dynamicFields)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-black/12 bg-white px-4 text-sm font-bold text-[#111114] hover:bg-stone-100 transition"
          >
            <Download className="h-4 w-4" /> Xuất DS phòng
          </button>

          <button
            type="button"
            onClick={() => exportPoliceTemporaryResidence(regs, dynamicFields)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-black/12 bg-white px-4 text-sm font-bold text-[#111114] hover:bg-stone-100 transition"
          >
            <Download className="h-4 w-4" /> Xuất Tạm trú CA
          </button>

          <button
            type="button"
            onClick={handleFullBackup}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#111114] px-4 text-sm font-extrabold text-white hover:bg-stone-800 transition"
          >
            <Download className="h-4 w-4" /> 1-Click Backup
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bento-card grid grid-cols-1 gap-3 rounded-3xl p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQ}
            onChange={e => {
              setLoading(true);
              setSearchQ(e.target.value);
            }}
            placeholder="Tìm MSSV hoặc Họ tên..."
            className={inputClass + " pl-11"}
          />
        </div>

        <select
          value={waveFilter}
          onChange={e => {
            setLoading(true);
            setWaveFilter(e.target.value);
          }}
          className={inputClass}
        >
          <option value="ALL">Tất cả đợt</option>
          {waves.map(w => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => {
            setLoading(true);
            setStatusFilter(e.target.value);
          }}
          className={inputClass}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
          <option value="CHECKED_OUT">Đã trả phòng</option>
        </select>

        <select
          value={buildingFilter}
          onChange={e => {
            setLoading(true);
            setBuildingFilter(e.target.value);
          }}
          className={inputClass}
        >
          <option value="ALL">Tất cả tòa nhà</option>
          {buildings.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={e => {
            setLoading(true);
            setGenderFilter(e.target.value);
          }}
          className={inputClass}
        >
          <option value="ALL">Tất cả giới tính</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
        </select>
      </div>

      {/* Table */}
      <div className="bento-card overflow-x-auto rounded-3xl">
        {loading ? (
          <div className="flex items-center justify-center p-14 text-base font-semibold text-stone-500">
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin text-[#c8102e]" /> Đang tải danh sách đơn...
          </div>
        ) : regs.length === 0 ? (
          <div className="p-14 text-center text-base font-semibold text-stone-500">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-stone-300" />
            Không có đơn đăng ký nào khớp bộ lọc.
          </div>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-black/10 bg-[#111114] text-xs font-extrabold uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === regs.length && regs.length > 0}
                    onChange={e =>
                      setSelectedIds(e.target.checked ? new Set(regs.map(r => r.id)) : new Set())
                    }
                    className="h-4 w-4 rounded accent-[#c8102e] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-4">MSSV / Họ tên</th>
                <th className="px-4 py-4">Giới tính / NS</th>
                <th className="px-4 py-4">Phòng</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {regs.map(r => {
                const st = STATUS_LABEL[r.status] ?? {
                  text: r.status,
                  cls: "bg-stone-100 text-stone-700",
                  dot: "bg-stone-400",
                };
                const isOver =
                  (r.rooms as unknown as { current_count: number; capacity: number }).current_count >
                  (r.rooms as unknown as { capacity: number }).capacity;
                return (
                  <tr key={r.id} className="hover:bg-[#f6f5f2]/80 transition">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() =>
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded accent-[#c8102e] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-extrabold text-[#111114]">{r.full_name}</p>
                      <p className="font-mono text-sm font-semibold text-stone-500">{r.student_code}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#111114]">{r.gender === "MALE" ? "Nam" : "Nữ"}</p>
                      <p className="font-mono text-sm text-stone-500">{r.dob}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-base font-extrabold text-[#c8102e]">
                        {r.rooms.room_code}
                      </span>
                      <p className="text-sm font-medium text-stone-500">{r.rooms.buildings.code}</p>
                      {isOver && (
                        <span className="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">
                          Vượt sức chứa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${st.cls}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailReg(r)}
                        className="rounded-xl border border-black/12 bg-white px-3 py-1.5 text-sm font-bold text-[#111114] hover:bg-stone-100"
                      >
                        Chi tiết
                      </button>
                      {r.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => updateStatus([r.id], "APPROVED")}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" /> Duyệt
                        </button>
                      )}
                      {(r.status === "PENDING" || r.status === "APPROVED") && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTransferReg(r);
                              setTRoomId("");
                              setTOverride(false);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#111114] px-3 py-1.5 text-sm font-bold text-white hover:bg-stone-800"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Chuyển
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectRegId(r.id);
                              setRejectReason("");
                            }}
                            className="rounded-xl bg-[#c8102e] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#a50d26]"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus([r.id], "CHECKED_OUT")}
                            className="inline-flex items-center gap-1 rounded-xl bg-stone-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-stone-700"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Thanh lý
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating Batch Approval Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 animate-fade-up rounded-2xl border border-white/15 bg-[#111114] px-5 py-3.5 text-white shadow-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-[#c8102e] px-3 py-1 text-sm font-extrabold">
              Đã chọn {selectedIds.size} đơn
            </span>
            <button
              type="button"
              onClick={() => updateStatus(Array.from(selectedIds), "APPROVED")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-500"
            >
              Duyệt hàng loạt
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectRegId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="obsidian-mesh flex items-center justify-between px-6 py-4 text-white">
              <h3 className="text-lg font-extrabold">Nhập lý do từ chối</h3>
              <button type="button" onClick={() => setRejectRegId(null)} className="rounded-xl bg-white/10 p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="VD: Sai thông tin sinh viên / Không thuộc đối tượng..."
                className="w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] p-3.5 text-base focus:border-[#c8102e] focus:bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectRegId(null)}
                  className="min-h-[44px] rounded-2xl border border-stone-300 px-5 text-sm font-bold text-stone-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateStatus([rejectRegId], "REJECTED", rejectReason);
                    setRejectRegId(null);
                  }}
                  className="min-h-[44px] rounded-2xl bg-[#c8102e] px-5 text-sm font-extrabold text-white hover:bg-[#a50d26]"
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {detailReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="obsidian-mesh flex items-center justify-between px-6 py-4 text-white">
              <h3 className="text-lg font-extrabold font-mono">
                Hồ sơ — {detailReg.student_code}
              </h3>
              <button
                type="button"
                onClick={() => setDetailReg(null)}
                className="rounded-xl bg-white/10 p-1.5 text-white/80 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-2.5 text-[15px]">
              <p>
                <strong className="text-stone-500">Họ tên:</strong>{" "}
                <span className="font-extrabold text-[#111114]">{detailReg.full_name}</span>
              </p>
              <p>
                <strong className="text-stone-500">Phòng:</strong>{" "}
                <span className="font-mono font-extrabold text-[#c8102e]">{detailReg.rooms.room_code}</span>
              </p>
              <p>
                <strong className="text-stone-500">Đợt:</strong>{" "}
                <span className="font-bold">{detailReg.registration_waves.name}</span>
              </p>
              {Object.entries(detailReg.extra_data ?? {}).map(([k, v]) => (
                <p key={k} className="rounded-xl bg-[#f6f5f2] px-3 py-2 text-sm">
                  <strong className="text-stone-600">{k}:</strong> {String(v)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleManualSubmit}
            className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="obsidian-mesh flex items-center justify-between px-6 py-4 text-white">
              <h3 className="text-lg font-extrabold">Thêm Sinh viên Thủ công</h3>
              <button type="button" onClick={() => setShowManual(false)} className="rounded-xl bg-white/10 p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3.5">
              <select required value={mWaveId} onChange={e => setMWaveId(e.target.value)} className={inputClass}>
                {waves.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select required value={mRoomId} onChange={e => setMRoomId(e.target.value)} className={inputClass}>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_code} ({r.current_count}/{r.capacity} - {r.gender_type})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Mã sinh viên"
                value={mCode}
                onChange={e => setMCode(e.target.value)}
                className={inputClass + " font-mono uppercase"}
              />
              <input
                required
                placeholder="Họ và tên"
                value={mName}
                onChange={e => setMName(e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <select value={mGender} onChange={e => setMGender(e.target.value as Gender)} className={inputClass}>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                </select>
                <input type="date" required value={mDob} onChange={e => setMDob(e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2.5 text-sm font-bold text-amber-800">
                <input
                  type="checkbox"
                  checked={mOverride}
                  onChange={e => setMOverride(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#c8102e]"
                />
                Cho phép vượt sức chứa chuẩn / ghi đè (Admin Override)
              </label>
              <button
                type="submit"
                className="min-h-[48px] w-full rounded-2xl bg-[#c8102e] text-[15px] font-extrabold text-white shadow-md hover:bg-[#a50d26] transition"
              >
                Xếp phòng ngay (APPROVED)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {transferReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleTransferSubmit}
            className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="obsidian-mesh flex items-center justify-between px-6 py-4 text-white">
              <h3 className="text-lg font-extrabold">Chuyển phòng — {transferReg.full_name}</h3>
              <button type="button" onClick={() => setTransferReg(null)} className="rounded-xl bg-white/10 p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[15px] text-stone-600">
                Phòng hiện tại: <strong className="font-mono text-[#c8102e]">{transferReg.rooms.room_code}</strong>
              </p>
              <select required value={tRoomId} onChange={e => setTRoomId(e.target.value)} className={inputClass}>
                <option value="">-- Chọn phòng đích --</option>
                {rooms
                  .filter(r => r.room_code !== transferReg.rooms.room_code)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.room_code} ({r.current_count}/{r.capacity} - {r.gender_type})
                    </option>
                  ))}
              </select>
              <label className="flex items-center gap-2.5 text-sm font-bold text-amber-800">
                <input
                  type="checkbox"
                  checked={tOverride}
                  onChange={e => setTOverride(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#c8102e]"
                />
                Cho phép vượt sức chứa / ghi đè giới tính
              </label>
              <button
                type="submit"
                className="min-h-[48px] w-full rounded-2xl bg-[#c8102e] text-[15px] font-extrabold text-white shadow-md hover:bg-[#a50d26] transition"
              >
                Xác nhận chuyển phòng
              </button>
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <ExcelImportModal
          waves={waves}
          rooms={rooms}
          onClose={() => setShowImport(false)}
          onImported={loadAll}
        />
      )}
    </div>
  );
}
