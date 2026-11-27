# BÁO CÁO KIỂM THỬ CHỊU TẢI (STRESS TEST REPORT) — KTX HANU

## 1. Mục tiêu & Kịch bản kiểm thử (k6)
Kiểm chứng khả năng chịu tải của kiến trúc 3 lớp (Edge Cache 3s + Refresh Cooldown 3s + Row-level Lock `FOR UPDATE`) trên gói miễn phí **Vercel Hobby** và **Supabase Free Tier**.

| Kịch bản | Mục tiêu | Công cụ & Tham số | Tiêu chí đạt (Pass) |
| :--- | :--- | :--- | :--- |
| **A — Cơn bão F5 (Read Heavy)** | Mô phỏng 3.000 SV tải danh sách 300 phòng liên tục | `k6` `ramping-arrival-rate` lên **300 req/s** trong 60s | Lỗi `5xx = 0%`, `p95 < 500ms`, CPU Supabase `< 40%` |
| **B — Tranh giành cực hạn (Contention)** | 200 người bấm đăng ký cùng lúc vào **1 phòng 6 chỗ** | `k6` `per-vu-iterations`: **200 VUs** × 1 lần | Đúng **6** đơn `201`, **194** đơn `409`, **0** lỗi `5xx` |
| **C — Thực chiến hỗn hợp (Mixed)** | Mô phỏng 3 phút mở cổng (vừa xem vừa chốt đơn) | **150 req/s đọc** + **30 req/s ghi** trong 3 phút | Tiêu thụ `< 15%` hạn mức Free/tháng |

---

## 2. Kết quả kiểm thử (Cập nhật sau khi chạy `k6`)

### 2.1. Kiểm chứng sơ bộ Edge Cache 3s trên Vercel Production
* Ngày thực hiện: `2026-11-27`
* Endpoint: `GET https://dormitory-management-system-one.vercel.app/api/public/rooms`
* Kết quả thực tế:
  * Request 1: `HTTP 200` | `x-vercel-cache: MISS`
  * Request 2 (trong 3s): `HTTP 200` | `x-vercel-cache: HIT`
  * Request 3 (trong 3s): `HTTP 200` | `x-vercel-cache: HIT`

### 2.2. Kiểm chứng Race Condition (Database Layer — `scripts/test-sprint1.mjs`)
* 50 request `Promise.all` đồng thời vào phòng 6 giường (trộn Nam/Nữ/trùng MSSV):
  * Thành công: **6/6** (100% cùng giới tính, `current_count = 6`)
  * Từ chối nghiệp vụ: **44/44** (0 lỗi hệ thống)

### 2.3. Kết quả chạy `k6` toàn trình *(Chờ chạy khi bật `LOAD_TEST_BYPASS_SECRET`)*
```powershell
# Kịch bản A
k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=A tests/load-test.js

# Kịch bản B
k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=B -e TARGET_ROOM_ID=<ROOM_UUID> -e BYPASS_SECRET=<SECRET> tests/load-test.js

# Kịch bản C
k6 run -e BASE_URL=https://dormitory-management-system-one.vercel.app -e SCENARIO=C -e TARGET_ROOM_ID=<ROOM_UUID> -e BYPASS_SECRET=<SECRET> tests/load-test.js
```

---

## 3. Xác nhận Bảo mật Go-Live (Checklist)
- [x] `REVOKE EXECUTE` trên `register_dorm_room` & `lookup_registration` từ `anon`
- [x] `POST /api/public/register` từ chối 100% request thiếu Turnstile token (`403 TURNSTILE_FAILED`)
- [ ] Xóa biến `LOAD_TEST_BYPASS_SECRET` trên Vercel sau khi chạy xong `k6` (nếu có bật)
- [ ] Dọn sạch dữ liệu test trước khi mở cổng chính thức cho sinh viên
