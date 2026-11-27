"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { DynamicField } from "@/lib/types";
import { cn } from "@/lib/utils";

function toLocalDatetimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [fields, setFields] = useState<DynamicField[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(j => {
        if (!active || !j.config) return;
        setIsPortalOpen(Boolean(j.config.is_portal_open));
        setOpenAt(toLocalDatetimeInput(j.config.open_at));
        setCloseAt(toLocalDatetimeInput(j.config.close_at));
        setAnnouncement(j.config.announcement ?? "");
        setFields(Array.isArray(j.config.dynamic_fields) ? j.config.dynamic_fields : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function addField() {
    const id = `field_${Date.now().toString().slice(-5)}`;
    setFields(prev => [
      ...prev,
      {
        id,
        label: "Câu hỏi mới",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
      },
    ]);
  }

  function updateField(index: number, patch: Partial<DynamicField>) {
    setFields(prev => prev.map((f, idx) => (idx === index ? { ...f, ...patch } : f)));
  }

  function moveField(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    setFields(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, idx) => idx !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const payload = {
      is_portal_open: isPortalOpen,
      open_at: openAt ? new Date(openAt).toISOString() : null,
      close_at: closeAt ? new Date(closeAt).toISOString() : null,
      announcement,
      dynamic_fields: fields.map(f => ({
        ...f,
        label: f.label.trim() || "Câu hỏi",
        options:
          f.type === "select"
            ? (f.options ?? []).map(o => o.trim()).filter(Boolean)
            : undefined,
      })),
    };

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMsg({ type: "ok", text: "Đã lưu cấu hình hệ thống & phiếu đăng ký!" });
    } else {
      const j = await res.json();
      setMsg({ type: "err", text: j.error ?? "Không thể lưu cấu hình." });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-14 text-base font-semibold text-stone-500">
        <Loader2 className="mr-2.5 h-5 w-5 animate-spin text-[#c8102e]" /> Đang tải cấu hình...
      </div>
    );
  }

  const inputClass =
    "min-h-[46px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 text-base font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
            Cài đặt Hệ thống & Phiếu đăng ký
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Bật/tắt cổng đăng ký, hẹn giờ mở/đóng tự động và tùy biến câu hỏi trên biểu mẫu sinh viên.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#c8102e] px-6 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 hover:bg-[#a50d26] disabled:bg-stone-400 transition"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Lưu toàn bộ cấu hình
        </button>
      </div>

      {msg && (
        <div
          className={`animate-fade-up rounded-2xl border px-5 py-3.5 text-[15px] font-bold ${
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Portal Schedule & Announcement */}
      <section className="bento-card rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-7 w-1.5 rounded-full bg-[#c8102e]" />
          <h2 className="text-xl font-extrabold text-[#111114]">
            1. Trạng thái Cổng đăng ký & Thông báo
          </h2>
        </div>

        <div
          onClick={() => setIsPortalOpen(v => !v)}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 p-5 transition",
            isPortalOpen
              ? "border-emerald-500 bg-emerald-50/70"
              : "border-black/10 bg-[#f6f5f2]"
          )}
        >
          <div>
            <p className="text-base font-extrabold text-[#111114]">
              Mở cổng đăng ký cho sinh viên
            </p>
            <p className="mt-0.5 text-sm text-stone-600">
              Nếu tắt, sinh viên sẽ thấy thông báo cổng đang đóng và không thể nộp đơn.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={isPortalOpen}
            className={cn(
              "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors",
              isPortalOpen ? "bg-emerald-600" : "bg-stone-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
                isPortalOpen ? "translate-x-6" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Tự động mở từ lúc (tùy chọn)
            </label>
            <input type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Tự động đóng vào lúc (tùy chọn)
            </label>
            <input type="datetime-local" value={closeAt} onChange={e => setCloseAt(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-stone-700">
            Thông báo hiển thị nổi bật trên Trang chủ Sinh viên
          </label>
          <textarea
            rows={3}
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="Nhập hướng dẫn hoặc thông báo lịch nộp hồ sơ..."
            className="w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] p-4 text-base focus:border-[#c8102e] focus:bg-white focus:outline-none"
          />
        </div>
      </section>

      {/* Dynamic Form Builder + Live Preview */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bento-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#111114]">
                2. Câu hỏi mở rộng trên Phiếu
              </h2>
              <p className="mt-0.5 text-sm text-stone-500">
                4 trường cố định (Họ tên, MSSV, Giới tính, Ngày sinh) luôn có sẵn.
              </p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1.5 rounded-2xl bg-[#111114] px-4 py-2.5 text-sm font-extrabold text-white hover:bg-[#c8102e] transition"
            >
              <Plus className="h-4 w-4" /> Thêm câu hỏi
            </button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-stone-300 p-8 text-center text-[15px] font-medium text-stone-500">
              Chưa có trường mở rộng nào. Bấm &quot;Thêm câu hỏi&quot; để tạo câu hỏi mới.
            </p>
          ) : (
            <div className="space-y-3.5">
              {fields.map((f, idx) => (
                <div
                  key={f.id}
                  className="rounded-2xl border border-black/10 bg-[#f6f5f2] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-stone-500">
                      #{idx + 1} · ID: {f.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-200 disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === fields.length - 1}
                        className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-200 disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      value={f.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder="Tên nhãn câu hỏi"
                      className="min-h-[42px] rounded-xl border border-black/15 bg-white px-3 text-[15px] font-medium"
                    />
                    <select
                      value={f.type}
                      onChange={e => updateField(idx, { type: e.target.value as DynamicField["type"] })}
                      className="min-h-[42px] rounded-xl border border-black/15 bg-white px-3 text-[15px] font-medium"
                    >
                      <option value="text">Văn bản (Text)</option>
                      <option value="number">Số (Number)</option>
                      <option value="select">Danh sách chọn (Dropdown)</option>
                      <option value="checkbox">Ô tích xác nhận (Checkbox)</option>
                    </select>
                  </div>

                  {f.type === "select" ? (
                    <input
                      type="text"
                      value={(f.options ?? []).join(", ")}
                      onChange={e => updateField(idx, { options: e.target.value.split(",") })}
                      placeholder="Các lựa chọn cách nhau bằng dấu phẩy (VD: Khoa Anh, Khoa Nhật)"
                      className="min-h-[40px] w-full rounded-xl border border-black/15 bg-white px-3 text-sm"
                    />
                  ) : f.type !== "checkbox" ? (
                    <input
                      type="text"
                      value={f.placeholder ?? ""}
                      onChange={e => updateField(idx, { placeholder: e.target.value })}
                      placeholder="Gợi ý nhập liệu (placeholder)"
                      className="min-h-[40px] w-full rounded-xl border border-black/15 bg-white px-3 text-sm"
                    />
                  ) : null}

                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-stone-700">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={e => updateField(idx, { required: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#c8102e]"
                    />
                    Bắt buộc sinh viên phải điền/chọn
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="bento-card overflow-hidden rounded-3xl">
          <div className="obsidian-mesh flex items-center gap-2.5 px-6 py-4 text-white">
            <Eye className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-extrabold">Xem trước Phiếu đăng ký (Live Preview)</h2>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3 opacity-60">
              {["Họ và tên *", "Mã sinh viên *", "Giới tính *", "Ngày sinh *"].map(lbl => (
                <div
                  key={lbl}
                  className="rounded-2xl border border-black/10 bg-[#f6f5f2] px-3.5 py-2.5 text-sm font-semibold"
                >
                  {lbl}
                </div>
              ))}
            </div>

            {fields.map(f => (
              <div key={f.id}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2.5 rounded-2xl border border-black/12 bg-[#f6f5f2] px-4 py-3 text-[15px] font-semibold">
                    <input type="checkbox" disabled className="h-4 w-4" />
                    <span>
                      {f.label} {f.required && <span className="text-[#c8102e]">*</span>}
                    </span>
                  </label>
                ) : f.type === "select" ? (
                  <div>
                    <p className="mb-1.5 text-sm font-bold text-stone-700">
                      {f.label} {f.required && <span className="text-[#c8102e]">*</span>}
                    </p>
                    <select
                      disabled
                      className="min-h-[44px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-3.5 text-[15px]"
                    >
                      <option>-- Chọn --</option>
                      {(f.options ?? [])
                        .map(o => o.trim())
                        .filter(Boolean)
                        .map(o => (
                          <option key={o}>{o}</option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 text-sm font-bold text-stone-700">
                      {f.label} {f.required && <span className="text-[#c8102e]">*</span>}
                    </p>
                    <input
                      type={f.type}
                      disabled
                      placeholder={f.placeholder || "Sinh viên nhập tại đây..."}
                      className="min-h-[44px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-3.5 text-[15px]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </form>
  );
}
