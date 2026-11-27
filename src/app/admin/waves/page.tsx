"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, CheckCircle2, Loader2, LogOut, Plus, X } from "lucide-react";

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
    let active = true;
    fetch("/api/admin/waves")
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (active && json) setWaves(json.waves ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
          Quản lý Đợt đăng ký (Waves)
        </h1>
        <p className="mt-1 text-[15px] text-stone-500">
          Mỗi thời điểm chỉ có tối đa 1 đợt đang hoạt động. Khi kích hoạt đợt mới, đợt cũ sẽ tự động tắt.
        </p>
      </div>

      {msg && (
        <div className="animate-fade-up rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-[15px] font-bold text-[#c8102e]">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bento-card flex flex-col gap-3 rounded-3xl p-5 sm:flex-row"
      >
        <input
          type="text"
          required
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Tên đợt mới (VD: Học kỳ 1 năm 2026 - 2027)..."
          className="min-h-[48px] flex-1 rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 text-base font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#c8102e] px-6 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/20 hover:bg-[#a50d26] disabled:bg-stone-400 transition"
        >
          <Plus className="h-5 w-5" />
          Tạo đợt mới
        </button>
      </form>

      <div className="bento-card overflow-hidden rounded-3xl">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-base font-semibold text-stone-500">
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin text-[#c8102e]" />
            Đang tải danh sách đợt...
          </div>
        ) : waves.length === 0 ? (
          <div className="p-12 text-center text-base font-semibold text-stone-500">
            <CalendarRange className="mx-auto mb-3 h-10 w-10 text-stone-300" />
            Chưa có đợt đăng ký nào.
          </div>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-black/10 bg-[#111114] text-xs font-extrabold uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-4">Tên đợt đăng ký</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {waves.map(w => (
                <tr key={w.id} className={w.is_active ? "bg-red-50/40" : "hover:bg-[#f6f5f2]"}>
                  <td className="px-5 py-4 font-extrabold text-[#111114]">{w.name}</td>
                  <td className="px-5 py-4">
                    {w.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-sm font-extrabold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Đang hoạt động
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-3.5 py-1 text-sm font-semibold text-stone-600">
                        Không hoạt động
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm font-medium text-stone-500">
                    {new Date(w.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    {!w.is_active && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleActivate(w.id)}
                        className="rounded-xl bg-[#111114] px-4 py-2 text-sm font-bold text-white hover:bg-[#c8102e] transition"
                      >
                        Kích hoạt (Active)
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setCheckoutWave(w);
                        setConfirmText("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-[#c8102e] hover:bg-red-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/8 pb-3">
              <h3 className="text-xl font-extrabold text-[#c8102e]">Xác nhận thanh lý hàng loạt</h3>
              <button
                type="button"
                onClick={() => setCheckoutWave(null)}
                className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[15px] text-stone-700 leading-relaxed">
              Thao tác này sẽ chuyển toàn bộ sinh viên đang ở hoặc chờ duyệt trong đợt{" "}
              <strong className="text-[#111114]">{checkoutWave.name}</strong> sang trạng thái{" "}
              <strong>Đã trả phòng (CHECKED_OUT)</strong> và đặt lại sĩ số phòng.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-stone-700">
                Nhập chính xác chữ <code className="font-mono text-[#c8102e]">XAC NHAN</code> để tiếp tục:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="XAC NHAN"
                className="min-h-[46px] w-full rounded-2xl border-2 border-stone-300 px-4 font-mono text-base font-bold uppercase focus:border-[#c8102e] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCheckoutWave(null)}
                className="min-h-[44px] rounded-2xl border border-stone-300 px-5 text-[15px] font-bold text-stone-700"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || confirmText.trim() !== "XAC NHAN"}
                onClick={handleCheckoutWave}
                className="min-h-[44px] rounded-2xl bg-[#c8102e] px-5 text-[15px] font-extrabold text-white disabled:bg-stone-300"
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
