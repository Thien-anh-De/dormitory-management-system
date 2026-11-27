"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { DynamicField } from "@/lib/types";

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
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [fields, setFields] = useState<DynamicField[]>([]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.config) {
          setIsPortalOpen(Boolean(j.config.is_portal_open));
          setOpenAt(toLocalDatetimeInput(j.config.open_at));
          setCloseAt(toLocalDatetimeInput(j.config.close_at));
          setAnnouncement(j.config.announcement ?? "");
          setFields(
            Array.isArray(j.config.dynamic_fields) ? j.config.dynamic_fields : []
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function addField() {
    const id = `field_${Date.now().toString().slice(-5)}`;
    setFields((prev) => [
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
    setFields((prev) =>
      prev.map((f, idx) => (idx === index ? { ...f, ...patch } : f))
    );
  }

  function moveField(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
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
      dynamic_fields: fields.map((f) => ({
        ...f,
        label: f.label.trim() || "Câu hỏi",
        options:
          f.type === "select"
            ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
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
      <div className="flex items-center justify-center p-10 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải cấu hình...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Cài đặt Hệ thống & Phiếu đăng ký (Zero-Code)
          </h1>
          <p className="text-xs text-slate-500">
            Bật/tắt cổng, hẹn giờ mở/đóng và tùy biến các câu hỏi mở rộng trên phiếu đăng ký.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lưu cấu hình
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Portal Schedule & Announcement */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          1. Trạng thái Cổng đăng ký & Thông báo
        </h2>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">
              Mở cổng đăng ký cho sinh viên
            </p>
            <p className="text-xs text-slate-500">
              Nếu tắt, sinh viên sẽ thấy thông báo cổng đang đóng và không thể nộp đơn.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isPortalOpen}
            onChange={(e) => setIsPortalOpen(e.target.checked)}
            className="h-5 w-5 rounded text-blue-600"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tự động mở từ lúc (tùy chọn)
            </label>
            <input
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tự động đóng vào lúc (tùy chọn)
            </label>
            <input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Thông báo hiển thị trên Trang chủ Sinh viên
          </label>
          <textarea
            rows={3}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Nhập hướng dẫn hoặc thông báo lịch nộp hồ sơ..."
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>
      </section>

      {/* Dynamic Form Builder + Live Preview */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. Câu hỏi mở rộng trên Phiếu đăng ký
              </h2>
              <p className="text-xs text-slate-500">
                4 trường cố định (Họ tên, MSSV, Giới tính, Ngày sinh) luôn có sẵn.
              </p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm trường
            </button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              Chưa có trường mở rộng nào. Bấm &quot;Thêm trường&quot; để tạo câu hỏi mới.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((f, idx) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      #{idx + 1} • ID: {f.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === fields.length - 1}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="rounded p-1 text-red-500 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Tên nhãn câu hỏi"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                    <select
                      value={f.type}
                      onChange={(e) =>
                        updateField(idx, {
                          type: e.target.value as DynamicField["type"],
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
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
                      onChange={(e) =>
                        updateField(idx, {
                          options: e.target.value.split(","),
                        })
                      }
                      placeholder="Các lựa chọn cách nhau bằng dấu phẩy (VD: Khoa Anh, Khoa Nhật)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  ) : f.type !== "checkbox" ? (
                    <input
                      type="text"
                      value={f.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(idx, { placeholder: e.target.value })
                      }
                      placeholder="Gợi ý nhập liệu (placeholder)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  ) : null}

                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) =>
                        updateField(idx, { required: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    Bắt buộc sinh viên phải điền/chọn
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Eye className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Xem trước Phiếu đăng ký (Live Preview)
            </h2>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2 opacity-60">
              <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                Họ và tên *
              </div>
              <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                Mã sinh viên *
              </div>
              <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                Giới tính *
              </div>
              <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                Ngày sinh *
              </div>
            </div>

            {fields.map((f) => (
              <div key={f.id}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                    <input type="checkbox" disabled />
                    <span>
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </span>
                  </label>
                ) : f.type === "select" ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-700">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </p>
                    <select
                      disabled
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    >
                      <option>-- Chọn --</option>
                      {(f.options ?? [])
                        .map((o) => o.trim())
                        .filter(Boolean)
                        .map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-700">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </p>
                    <input
                      type={f.type}
                      disabled
                      placeholder={f.placeholder || "Sinh viên nhập tại đây..."}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
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
