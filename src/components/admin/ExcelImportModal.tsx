"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import type { PublicRoom } from "@/lib/types";

interface Wave {
  id: string;
  name: string;
  is_active: boolean;
}

interface ParsedRow {
  rowNum: number;
  student_code: string;
  full_name: string;
  gender: "MALE" | "FEMALE" | "";
  dob: string;
  room_code: string;
  phone: string;
  error: string | null;
}

interface ExcelImportModalProps {
  waves: Wave[];
  rooms: PublicRoom[];
  onClose: () => void;
  onImported: () => void;
}

function normalizeDob(raw: unknown): string {
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }
  }
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

function normalizeGender(raw: unknown): "MALE" | "FEMALE" | "" {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "nam" || s === "male" || s === "m") return "MALE";
  if (s === "nữ" || s === "nu" || s === "female" || s === "f") return "FEMALE";
  return "";
}

export function ExcelImportModal({ waves, rooms, onClose, onImported }: ExcelImportModalProps) {
  const activeWave = waves.find(w => w.is_active) ?? waves[0];
  const [waveId, setWaveId] = useState(activeWave?.id ?? "");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<{ ok: number; fail: number } | null>(null);

  function downloadTemplate() {
    const sample = [
      {
        MSSV: "22010001",
        Ho_ten: "Nguyễn Văn An",
        Gioi_tinh: "Nam",
        Ngay_sinh: "15/05/2004",
        Ma_phong: rooms[0]?.room_code ?? "201D10",
        So_dien_thoai: "0987654321",
      },
      {
        MSSV: "22010002",
        Ho_ten: "Trần Thị Bình",
        Gioi_tinh: "Nữ",
        Ngay_sinh: "2004-08-20",
        Ma_phong: rooms[1]?.room_code ?? "202D10",
        So_dien_thoai: "0912345678",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Import_SV");
    XLSX.writeFile(wb, "KTX_Mau_Import_SV.xlsx");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReport(null);

    const reader = new FileReader();
    reader.onload = evt => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const roomSet = new Set(rooms.map(r => r.room_code));
      const seenCodes = new Set<string>();

      const validated: ParsedRow[] = rawRows.map((raw, idx) => {
        const student_code = String(raw.MSSV ?? raw.student_code ?? "").trim().toUpperCase();
        const full_name = String(raw.Ho_ten ?? raw.full_name ?? "").trim();
        const gender = normalizeGender(raw.Gioi_tinh ?? raw.gender);
        const dob = normalizeDob(raw.Ngay_sinh ?? raw.dob);
        const room_code = String(raw.Ma_phong ?? raw.room_code ?? "").trim();
        const phone = String(raw.So_dien_thoai ?? raw.phone ?? "").trim();

        let error: string | null = null;
        if (!student_code) error = "Thiếu MSSV";
        else if (seenCodes.has(student_code)) error = "Trùng MSSV trong file";
        else if (!full_name) error = "Thiếu Họ tên";
        else if (!gender) error = "Giới tính phải là Nam/Nữ";
        else if (!dob) error = "Ngày sinh không hợp lệ";
        else if (!room_code || !roomSet.has(room_code)) error = `Không tồn tại phòng "${room_code}"`;

        if (student_code) seenCodes.add(student_code);

        return {
          rowNum: idx + 2,
          student_code,
          full_name,
          gender,
          dob,
          room_code,
          phone,
          error,
        };
      });

      setRows(validated);
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);

  async function handleRunImport() {
    if (!waveId || validRows.length === 0) return;
    setImporting(true);
    setProgress(0);

    const CHUNK_SIZE = 80;
    let totalOk = 0;
    let totalFail = errorRows.length;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE).map(r => ({
        wave_id: waveId,
        room_code: r.room_code,
        student_code: r.student_code,
        full_name: r.full_name,
        gender: r.gender,
        dob: r.dob,
        extra_data: r.phone ? { phone: r.phone } : {},
      }));

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk }),
      });

      if (res.ok) {
        const j = await res.json();
        totalOk += j.success_count ?? 0;
        totalFail += j.error_count ?? 0;
      } else {
        totalFail += chunk.length;
      }

      setProgress(Math.min(100, Math.round(((i + chunk.length) / validRows.length) * 100)));
    }

    setReport({ ok: totalOk, fail: totalFail });
    setImporting(false);
    onImported();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-up flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="obsidian-mesh flex items-center justify-between px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Import Danh sách Sinh viên từ Excel</h2>
              <p className="text-sm text-white/70">Kiểm tra lỗi tự động trước khi nạp vào cơ sở dữ liệu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/80 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#f6f5f2] p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold text-stone-700">Đợt nhập:</span>
              <select
                value={waveId}
                onChange={e => setWaveId(e.target.value)}
                className="min-h-[42px] rounded-xl border border-black/15 bg-white px-3.5 text-sm font-bold"
              >
                {waves.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.is_active ? "(Đang hoạt động)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border-2 border-emerald-600 bg-white px-4 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50"
            >
              <Download className="h-4 w-4" /> Tải file Excel mẫu
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-300 bg-[#f6f5f2] p-8 transition hover:border-[#c8102e] hover:bg-red-50/30">
            <Upload className="mb-2.5 h-8 w-8 text-[#c8102e]" />
            <span className="text-base font-extrabold text-[#111114]">
              Chọn file Excel (.xlsx, .xls) để kiểm tra dữ liệu
            </span>
            <span className="mt-1 text-sm text-stone-500">Hỗ trợ nhập hàng trăm sinh viên cùng lúc</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          </label>

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-5 text-sm font-extrabold">
                <span className="text-emerald-700">✓ Hợp lệ: {validRows.length} dòng</span>
                <span className="text-[#c8102e]">✗ Lỗi: {errorRows.length} dòng</span>
              </div>

              <div className="max-h-60 overflow-auto rounded-2xl border border-black/10">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#111114] text-xs font-extrabold uppercase text-white">
                    <tr>
                      <th className="px-3.5 py-2.5">Dòng</th>
                      <th className="px-3.5 py-2.5">MSSV</th>
                      <th className="px-3.5 py-2.5">Họ tên</th>
                      <th className="px-3.5 py-2.5">Phòng</th>
                      <th className="px-3.5 py-2.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6">
                    {rows.slice(0, 100).map(r => (
                      <tr key={r.rowNum} className={r.error ? "bg-red-50 text-red-900" : "bg-emerald-50/40"}>
                        <td className="px-3.5 py-2 font-mono">{r.rowNum}</td>
                        <td className="px-3.5 py-2 font-mono font-bold">{r.student_code}</td>
                        <td className="px-3.5 py-2 font-semibold">{r.full_name}</td>
                        <td className="px-3.5 py-2 font-mono font-bold">{r.room_code}</td>
                        <td className="px-3.5 py-2 font-bold">{r.error ?? "Hợp lệ"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-1.5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200">
                <div className="h-full brand-gradient transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-sm font-bold text-stone-600">Đang nạp dữ liệu... {progress}%</p>
            </div>
          )}

          {report && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              Hoàn tất: Import thành công {report.ok} sinh viên, bỏ qua/lỗi {report.fail} dòng.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/8 bg-[#f6f5f2] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-2xl border-2 border-stone-300 bg-white px-5 text-[15px] font-bold text-stone-700 hover:bg-stone-100"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={importing || validRows.length === 0}
            onClick={handleRunImport}
            className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#c8102e] px-6 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/20 hover:bg-[#a50d26] disabled:bg-stone-300"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Import {validRows.length} dòng hợp lệ
          </button>
        </div>
      </div>
    </div>
  );
}
