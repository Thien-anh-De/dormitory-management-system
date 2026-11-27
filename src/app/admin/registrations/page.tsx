"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Check,
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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { text: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { text: "Từ chối", cls: "bg-red-100 text-red-800" },
  CHECKED_OUT: { text: "Đã trả phòng", cls: "bg-slate-200 text-slate-700" },
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
    loadAll();
  }, [loadAll]);

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
    if (mOverride && !confirm("Xác nhận xếp sinh viên VƯỢT SỨC CHỨA / GHI ĐÈ?")) {
      return;
    }
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
    const dst = rooms.find((r) => r.id === tRoomId);
    if (
      dst &&
      dst.gender_type !== "EMPTY" &&
      dst.gender_type !== transferReg.gender
    ) {
      if (
        !confirm(
          `CẢNH BÁO: Bạn đang chuyển SV ${
            transferReg.gender === "MALE" ? "Nam" : "Nữ"
          } sang phòng ${dst.room_code} (${
            dst.gender_type === "MALE" ? "Nam" : "Nữ"
          }). Xác nhận?`
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Xét duyệt Đơn & Quản lý Lưu trú ({regs.length})
          </h1>
          <p className="text-xs text-slate-500">
            Duyệt đơn, từ chối, chuyển phòng, nhập SV khóa cũ và xuất báo cáo Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Thêm SV thủ công
          </button>

          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Import Excel
          </button>

          <button
            type="button"
            onClick={() => exportStudentsByRoom(regs, dynamicFields)}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất DS phòng
          </button>

          <button
            type="button"
            onClick={() => exportPoliceTemporaryResidence(regs, dynamicFields)}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất Tạm trú CA
          </button>

          <button
            type="button"
            onClick={handleFullBackup}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> 1-Click Backup
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Tìm MSSV hoặc Họ tên..."
            className="min-h-[38px] w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm"
          />
        </div>

        <select
          value={waveFilter}
          onChange={(e) => setWaveFilter(e.target.value)}
          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="ALL">Tất cả đợt</option>
          {waves.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
          <option value="CHECKED_OUT">Đã trả phòng</option>
        </select>

        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="ALL">Tất cả tòa nhà</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="ALL">Tất cả giới tính</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold">
          <span>Đã chọn {selectedIds.size} đơn:</span>
          <button
            type="button"
            onClick={() => updateStatus(Array.from(selectedIds), "APPROVED")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white"
          >
            Duyệt hàng loạt
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-slate-600 underline"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-10 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : regs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Không có đơn đăng ký nào khớp bộ lọc.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === regs.length && regs.length > 0}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? new Set(regs.map((r) => r.id)) : new Set()
                      )
                    }
                  />
                </th>
                <th className="px-3 py-3">MSSV / Họ tên</th>
                <th className="px-3 py-3">Giới tính / NS</th>
                <th className="px-3 py-3">Phòng</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regs.map((r) => {
                const st = STATUS_LABEL[r.status] ?? {
                  text: r.status,
                  cls: "bg-slate-100",
                };
                const isOver =
                  (r.rooms as unknown as { current_count: number; capacity: number })
                    .current_count >
                  (r.rooms as unknown as { capacity: number }).capacity;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-900">{r.full_name}</p>
                      <p className="font-mono text-slate-500">{r.student_code}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{r.gender === "MALE" ? "Nam" : "Nữ"}</p>
                      <p className="text-slate-500">{r.dob}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-bold text-blue-700">{r.rooms.room_code}</span>
                      <p className="text-slate-500">{r.rooms.buildings.code}</p>
                      {isOver && (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Vượt sức chứa
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 font-semibold ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailReg(r)}
                        className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                      >
                        Chi tiết
                      </button>
                      {r.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => updateStatus([r.id], "APPROVED")}
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-2 py-1 text-white"
                        >
                          <Check className="h-3 w-3" /> Duyệt
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
                            className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-2 py-1 text-white"
                          >
                            <ArrowRightLeft className="h-3 w-3" /> Chuyển
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectRegId(r.id);
                              setRejectReason("");
                            }}
                            className="rounded bg-red-600 px-2 py-1 text-white"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus([r.id], "CHECKED_OUT")}
                            className="inline-flex items-center gap-0.5 rounded bg-slate-700 px-2 py-1 text-white"
                          >
                            <LogOut className="h-3 w-3" /> Thanh lý
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

      {/* Reject Dialog */}
      {rejectRegId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="text-base font-bold text-slate-900">Nhập lý do từ chối</h3>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Sai thông tin sinh viên / Không thuộc đối tượng..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectRegId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateStatus([rejectRegId], "REJECTED", rejectReason);
                  setRejectRegId(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {detailReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900">
                Thông tin đơn — {detailReg.student_code}
              </h3>
              <button
                type="button"
                onClick={() => setDetailReg(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              <p><strong>Họ tên:</strong> {detailReg.full_name}</p>
              <p><strong>Phòng:</strong> {detailReg.rooms.room_code}</p>
              <p><strong>Đợt:</strong> {detailReg.registration_waves.name}</p>
              {Object.entries(detailReg.extra_data ?? {}).map(([k, v]) => (
                <p key={k}>
                  <strong>{k}:</strong> {String(v)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Thêm Sinh viên Thủ công</h3>
              <button type="button" onClick={() => setShowManual(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <select
              required
              value={mWaveId}
              onChange={(e) => setMWaveId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {waves.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select
              required
              value={mRoomId}
              onChange={(e) => setMRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_code} ({r.current_count}/{r.capacity} - {r.gender_type})
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Mã sinh viên"
              value={mCode}
              onChange={(e) => setMCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
            />
            <input
              required
              placeholder="Họ và tên"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={mGender}
                onChange={(e) => setMGender(e.target.value as Gender)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
              </select>
              <input
                type="date"
                required
                value={mDob}
                onChange={(e) => setMDob(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <input
                type="checkbox"
                checked={mOverride}
                onChange={(e) => setMOverride(e.target.checked)}
              />
              Cho phép vượt sức chứa chuẩn / ghi đè (Admin Override)
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white"
            >
              Xếp phòng ngay (APPROVED)
            </button>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {transferReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleTransferSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                Chuyển phòng — {transferReg.full_name}
              </h3>
              <button type="button" onClick={() => setTransferReg(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Phòng hiện tại: <strong>{transferReg.rooms.room_code}</strong>
            </p>
            <select
              required
              value={tRoomId}
              onChange={(e) => setTRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn phòng đích --</option>
              {rooms
                .filter((r) => r.id !== transferReg.rooms.room_code)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_code} ({r.current_count}/{r.capacity} - {r.gender_type})
                  </option>
                ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <input
                type="checkbox"
                checked={tOverride}
                onChange={(e) => setTOverride(e.target.checked)}
              />
              Cho phép vượt sức chứa / ghi đè giới tính
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white"
            >
              Xác nhận chuyển phòng
            </button>
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
