"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, LogOut, Plus, X } from "lucide-react";

interface Wave {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminWavesPage() {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkoutWave, setCheckoutWave] = useState<Wave | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const loadWaves = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/waves");
    if (res.ok) {
      const json = await res.json();
      setWaves(json.waves ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWaves();
  }, [loadWaves]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setMsg(null);
    const res = await fetch("/api/admin/waves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      await loadWaves();
      setMsg("Đã tạo đợt đăng ký mới.");
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Lỗi tạo đợt.");
    }
    setSubmitting(false);
  }

  async function handleActivate(id: string) {
    setSubmitting(true);
    setMsg(null);
    const res = await fetch("/api/admin/waves", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "ACTIVATE" }),
    });
    if (res.ok) {
      await loadWaves();
      setMsg("Đã chuyển đợt đăng ký đang hoạt động.");
    }
    setSubmitting(false);
  }

  async function handleCheckoutWave() {
    if (!checkoutWave || confirmText.trim() !== "XAC NHAN") return;
    setSubmitting(true);
    setMsg(null);
    const res = await fetch("/api/admin/waves/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wave_id: checkoutWave.id }),
    });
    const j = await res.json();
    if (res.ok) {
      setMsg(
        `Đã thanh lý ${j.checked_out_count ?? 0} đơn thuộc "${checkoutWave.name}" và làm sạch sĩ số phòng.`
      );
      setCheckoutWave(null);
      setConfirmText("");
    } else {
      setMsg(j.error ?? "Không thể thanh lý đợt.");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Quản lý Đợt đăng ký (Waves)</h1>
        <p className="text-xs text-slate-500">
          Mỗi thời điểm chỉ có tối đa 1 đợt đang hoạt động (Active). Khi kích hoạt đợt mới, đợt cũ sẽ tự động tắt.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <input
          type="text"
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Tên đợt mới (VD: HK1 2026-2027)..."
          className="min-h-[42px] flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
        >
          <Plus className="h-4 w-4" />
          Tạo đợt mới
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : waves.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Chưa có đợt đăng ký nào.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Tên đợt</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {waves.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{w.name}</td>
                  <td className="px-4 py-3">
                    {w.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Đang hoạt động
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Không hoạt động
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(w.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {!w.is_active && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleActivate(w.id)}
                        className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setCheckoutWave(w);
                        setConfirmText("");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Thanh lý đợt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {checkoutWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-red-700">
                Xác nhận thanh lý hàng loạt
              </h3>
              <button
                type="button"
                onClick={() => setCheckoutWave(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Thao tác này sẽ chuyển toàn bộ sinh viên đang ở hoặc chờ duyệt trong đợt{" "}
              <strong>{checkoutWave.name}</strong> sang trạng thái{" "}
              <strong>Đã trả phòng (CHECKED_OUT)</strong> và đặt lại sĩ số phòng.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Nhập chính xác chữ <code className="text-red-600">XAC NHAN</code> để tiếp tục:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="XAC NHAN"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCheckoutWave(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || confirmText.trim() !== "XAC NHAN"}
                onClick={handleCheckoutWave}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
              >
                Thanh lý toàn bộ đợt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
