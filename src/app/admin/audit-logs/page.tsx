"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_OPTIONS = [
  "ALL",
  "UPDATE_REG_STATUS",
  "TRANSFER_ROOM",
  "TRANSFER_ROOM_OVERRIDE",
  "ADD_STUDENT_MANUAL",
  "OVERRIDE_CAPACITY",
  "CHECKOUT_WAVE",
  "ACTIVATE_WAVE",
  "IMPORT_BATCH",
  "UPDATE_SYSTEM_CONFIG",
];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), action: actionFilter });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setLogs(j.logs ?? []);
      setTotalPages(j.totalPages ?? 1);
    }
    setLoading(false);
  }, [page, actionFilter, fromDate, toDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nhật ký hoạt động (Audit Logs)</h1>
        <p className="text-xs text-slate-500">
          Ghi nhận bất biến toàn bộ thao tác duyệt đơn, chuyển phòng, ghi đè và cấu hình hệ thống.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <select
          value={actionFilter}
          onChange={(e) => {
            setPage(1);
            setActionFilter(e.target.value);
          }}
          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a === "ALL" ? "Tất cả hành động" : a}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setPage(1);
            setFromDate(e.target.value);
          }}
          className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm"
        />
        <span className="text-xs text-slate-500">đến</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => {
            setPage(1);
            setToDate(e.target.value);
          }}
          className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Không có bản ghi nhật ký nào.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {new Date(l.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{l.actor}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-800">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.target_type}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDetailLog(l)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Xem JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Trang {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>

      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Chi tiết Snapshot — {detailLog.action}
              </h3>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
              {JSON.stringify(detailLog.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
