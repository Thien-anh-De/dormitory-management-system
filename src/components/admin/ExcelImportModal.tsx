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

export function ExcelImportModal({
  waves,
  rooms,
  onClose,
  onImported,
}: ExcelImportModalProps) {
  const activeWave = waves.find((w) => w.is_active) ?? waves[0];
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
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const roomSet = new Set(rooms.map((r) => r.room_code));
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

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  async function handleRunImport() {
    if (!waveId || validRows.length === 0) return;
    setImporting(true);
    setProgress(0);

    const CHUNK_SIZE = 80;
    let totalOk = 0;
    let totalFail = errorRows.length;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE).map((r) => ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Import Danh sách Sinh viên từ Excel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Đợt nhập:</span>
            <select
              value={waveId}
              onChange={(e) => setWaveId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              {waves.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.is_active ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="h-3.5 w-3.5" /> Tải file Excel mẫu
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 hover:border-blue-400">
          <Upload className="mb-2 h-6 w-6 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Chọn file Excel (.xlsx, .xls) để kiểm tra dữ liệu
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-emerald-700">✓ Hợp lệ: {validRows.length}</span>
              <span className="text-red-600">✗ Lỗi: {errorRows.length}</span>
            </div>

            <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Dòng</th>
                    <th className="px-3 py-2">MSSV</th>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Phòng</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 100).map((r) => (
                    <tr
                      key={r.rowNum}
                      className={r.error ? "bg-red-50 text-red-800" : "bg-emerald-50/40"}
                    >
                      <td className="px-3 py-1.5">{r.rowNum}</td>
                      <td className="px-3 py-1.5 font-mono">{r.student_code}</td>
                      <td className="px-3 py-1.5">{r.full_name}</td>
                      <td className="px-3 py-1.5">{r.room_code}</td>
                      <td className="px-3 py-1.5 font-medium">
                        {r.error ?? "Hợp lệ"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importing && (
          <div className="space-y-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-slate-500">
              Đang nạp dữ liệu... {progress}%
            </p>
          </div>
        )}

        {report && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900">
            Hoàn tất: Import thành công {report.ok} sinh viên, bỏ qua/lỗi {report.fail} dòng.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={importing || validRows.length === 0}
            onClick={handleRunImport}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Import {validRows.length} dòng hợp lệ
          </button>
        </div>
      </div>
    </div>
  );
}
