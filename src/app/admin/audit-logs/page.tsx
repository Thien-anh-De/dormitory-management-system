"use client";

import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";

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

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), action: actionFilter });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    fetch(`/api/admin/audit-logs?${params.toString()}`)
      .then(res => (res.ok ? res.json() : null))
      .then(j => {
        if (!active || !j) return;
        setLogs(j.logs ?? []);
        setTotalPages(j.totalPages ?? 1);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, actionFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
          Nhật ký hoạt động (Audit Logs)
        </h1>
        <p className="mt-1 text-[15px] text-stone-500">
          Ghi nhận bất biến toàn bộ thao tác duyệt đơn, chuyển phòng, ghi đè và cấu hình hệ thống.
        </p>
      </div>

      <div className="bento-card flex flex-wrap items-center gap-3 rounded-3xl p-4 sm:p-5">
        <select
          value={actionFilter}
          onChange={e => {
            setLoading(true);
            setPage(1);
            setActionFilter(e.target.value);
          }}
          className="min-h-[46px] rounded-2xl border border-black/15 bg-[#f6f5f2] px-4 text-[15px] font-semibold focus:border-[#c8102e] focus:bg-white focus:outline-none"
        >
          {ACTION_OPTIONS.map(a => (
            <option key={a} value={a}>
              {a === "ALL" ? "Tất cả hành động" : a}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={e => {
            setLoading(true);
            setPage(1);
            setFromDate(e.target.value);
          }}
          className="min-h-[46px] rounded-2xl border border-black/15 bg-[#f6f5f2] px-4 text-[15px] font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none"
        />
        <span className="text-sm font-bold text-stone-500">đến</span>
        <input
          type="date"
          value={toDate}
          onChange={e => {
            setLoading(true);
            setPage(1);
            setToDate(e.target.value);
          }}
          className="min-h-[46px] rounded-2xl border border-black/15 bg-[#f6f5f2] px-4 text-[15px] font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none"
        />
      </div>

      <div className="bento-card overflow-x-auto rounded-3xl">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-base font-semibold text-stone-500">
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin text-[#c8102e]" /> Đang tải nhật ký...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-base font-semibold text-stone-500">
            <History className="mx-auto mb-3 h-10 w-10 text-stone-300" />
            Không có bản ghi nhật ký nào.
          </div>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-black/10 bg-[#111114] text-xs font-extrabold uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-4">Thời gian</th>
                <th className="px-5 py-4">Người thực hiện</th>
                <th className="px-5 py-4">Hành động</th>
                <th className="px-5 py-4">Đối tượng</th>
                <th className="px-5 py-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-[#f6f5f2]">
                  <td className="px-5 py-4 whitespace-nowrap font-mono text-sm text-stone-600">
                    {new Date(l.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-5 py-4 font-bold text-[#111114]">{l.actor}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-mono text-xs font-extrabold text-[#111114]">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium text-stone-600">{l.target_type}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDetailLog(l)}
                      className="rounded-xl border border-black/12 bg-white px-3.5 py-1.5 text-sm font-bold text-[#c8102e] hover:bg-red-50 transition"
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

      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-stone-600">
          Trang {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage(p => p - 1);
            }}
            className="rounded-xl border border-black/12 bg-white px-4 py-2 font-bold text-[#111114] hover:bg-stone-100 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setLoading(true);
              setPage(p => p + 1);
            }}
            className="rounded-xl border border-black/12 bg-white px-4 py-2 font-bold text-[#111114] hover:bg-stone-100 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>

      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="obsidian-mesh flex items-center justify-between px-6 py-4 text-white">
              <h3 className="text-base font-extrabold">Chi tiết Snapshot — {detailLog.action}</h3>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                className="rounded-xl bg-white/10 p-1.5 text-white/80 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <pre className="max-h-96 overflow-auto rounded-2xl bg-[#111114] p-4 font-mono text-sm text-emerald-300">
                {JSON.stringify(detailLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
