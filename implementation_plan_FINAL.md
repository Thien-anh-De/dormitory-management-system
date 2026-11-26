# LỘ TRÌNH TRIỂN KHAI HỆ THỐNG WEB QUẢN LÝ KÝ TÚC XÁ (ONLINE) — FINAL

> [!IMPORTANT]
> **🔒 PHIÊN BẢN CHỐT — ĐÃ ĐƯỢC DUYỆT (v1 → v2 → v2.1 → FINAL)**
> Tài liệu này là lộ trình thi công chính thức. Không chỉnh sửa thêm nếu không có lý do kỹ thuật mới. Lịch sử thay đổi đầy đủ ở **Phụ lục 5.3**.
>
> **Tổng hợp cải tiến so với v1 gốc (14 thay đổi):**
> - **v2.0:** Timeline 14→21 ngày/5→6 Sprint | Junction table `room_amenities` | Bảng `audit_logs` | Chunked batch import | RPC `activate_wave` | 500→200 VUs stress test | Error Recovery Protocol | Security headers | Bảng ngưỡng Free Tier | Tài liệu bàn giao mở rộng
> - **v2.1:** Chặn bypass Turnstile (REVOKE EXECUTE từ `anon`) | UNIQUE(`student_code`) toàn hệ thống thay vì per-wave | Cấm query string phá cache | `ramping-arrival-rate` k6 | RPC `admin_checkout_wave` thanh lý hàng loạt | Làm rõ `recalculate_room_counts()` đếm toàn bảng

---

## 1. Tổng quan Dự án & Kiến trúc Hệ thống

### 1.1. Mục tiêu & Quy mô
* **Quy mô:** 300 phòng, phục vụ tối đa 3.000 sinh viên truy cập và đăng ký đồng thời không sập hệ thống.
* **Phân quyền:**
  * **1 Tài khoản Admin duy nhất:** Toàn quyền cấu hình hệ thống (Zero-Code), không cần lập trình viên can thiệp sau bàn giao.
  * **Cổng Sinh viên (Public Portal):** Truy cập trực tiếp qua đường link (không cần đăng ký tài khoản), xem sơ đồ phòng trống, nhãn giới tính động (Nam/Nữ/Trống), tiện ích, sức chứa, điền phiếu đăng ký và tra cứu kết quả.
* **Chi phí vận hành:** 0 đồng (sử dụng 100% gói miễn phí, thiết kế chống ngủ đông để vận hành bền vững nhiều năm).
* **Kế thừa nghiệp vụ thực tế (từ phần mềm EduSoft.NET cũ):** Phân cấp `Tòa nhà/Dãy -> Tầng -> Phòng`, hỗ trợ phòng sức chứa `0` (bảo trì/kho), cho phép Admin ghi đè xếp vượt sức chứa trong ca ngoại lệ, quản lý chuyển phòng/thanh lý, nạp danh sách SV khóa cũ (Import Excel) và xuất danh sách tạm trú gửi công an (Export Excel).

### 1.2. Công nghệ sử dụng (Tech Stack — 100% Free Tier)

| Thành phần | Công nghệ | Vai trò & Giới hạn Free Tier |
| :--- | :--- | :--- |
| **Frontend & API** | Next.js (App Router, TypeScript), Tailwind CSS, Shadcn/UI | Deploy trên **Vercel Hobby** (100GB Bandwidth, 1.000.000 Edge Requests/tháng). **Lưu ý: Serverless Function timeout = 10 giây.** |
| **Database & Auth** | **Supabase (PostgreSQL)** | 500MB DB, 200 kết nối đồng thời qua Transaction Pooler (Port `6543`), xác thực 1 tài khoản Admin. **Lưu ý: RPC rate limit ~100 req/s trên free tier.** |
| **Chống Bot & Chống Spam** | **Cloudflare Turnstile** + Payload Limit (10KB) | Miễn phí, chặn tool auto-click/spam đơn tại nút đăng ký (có thể bật thêm Vercel WAF Rate Limiting miễn phí trên dashboard). |
| **Chống ngủ đông DB** | **GitHub Actions (Cron Job)** | Tự động ping Supabase mỗi 3 ngày/lần để tránh cơ chế Auto-Pause sau 7 ngày không hoạt động. **Có cơ chế alert nếu ping thất bại.** |
| **Xử lý Excel** | **SheetJS (`xlsx`)** | Import/Export Excel trên trình duyệt (Client-side), không tốn tài nguyên Server. **Import lớn (>500 dòng) dùng chunked batch.** |
| **Kiểm thử chịu tải** | **k6 (Grafana)** | Giả lập lưu lượng tương đương 3.000 người dùng (dùng `ramping-arrival-rate`) để kiểm chứng trước khi bàn giao. |

### 1.3. Kiến trúc Chịu tải 3 Lớp (Chống sập & Chống tranh chấp chỗ)

```mermaid
flowchart LR
    A["3.000 SV<br>bấm F5"] -->|GET /api/public/rooms<br>(không query string)| B["Lớp 1: Edge Cache<br>s-maxage=3s"]
    B -->|MISS mỗi 3s| C["Supabase DB<br>~1 query/3s"]
    B -->|HIT| D["Trả JSON<br>từ RAM CDN"]
    
    E["SV bấm<br>Cập nhật"] -->|Cooldown 3s<br>cache: no-store| F["Lớp 2: Nút Refresh<br>có Cooldown"]
    F --> B
    
    G["SV bấm<br>Đăng ký"] -->|POST /api/public/register<br>Verify Turnstile + Zod| H["Lớp 3: SQL RPC<br>SELECT...FOR UPDATE<br>(qua service_role)"]
    H -->|OK| I["Đơn PENDING<br>+1 current_count"]
    H -->|ROOM_FULL| J["Trả lỗi<br>cập nhật nóng UI"]
```

1. **Lớp 1 — Edge Cache 3 giây (Luồng Đọc):** API lấy danh sách 300 phòng gắn header `Cache-Control: public, s-maxage=3, stale-while-revalidate=5`. 3.000 sinh viên F5 cùng lúc chỉ đọc từ RAM của CDN, Supabase chỉ xử lý tối đa 1 truy vấn mỗi 3 giây.
2. **Lớp 2 — Nút làm mới có Cooldown 3 giây:** Không dùng Auto-polling hay Realtime WebSocket. Giao diện tải 1 lần và có nút **"Cập nhật phòng trống"** bị khóa 3 giây sau mỗi lần bấm, gọi `fetch('/api/public/rooms', { cache: 'no-store' })` (**tuyệt đối không gắn query string `?t=...`**) để bỏ qua cache trình duyệt nhưng vẫn ăn trọn Edge Cache 3 giây của Vercel.
3. **Lớp 3 — Khóa mức dòng PostgreSQL (Luồng Ghi):** Khi sinh viên bấm "Đăng ký", request `POST` đi qua API Next.js để xác thực Cloudflare Turnstile + Zod, sau đó server dùng `service_role` gọi hàm SQL RPC `SELECT ... FOR UPDATE` trên đúng dòng của phòng được chọn. Nếu phòng vừa hết chỗ trong khoảng trễ 3 giây của Cache, DB từ chối ngay lập tức, trả mã lỗi `ROOM_FULL` và giao diện tự động cập nhật nóng trạng thái phòng thành "Đã đầy" trên máy sinh viên.

### 1.4. Giới hạn Free Tier & Ngưỡng an toàn

> [!IMPORTANT]
> Bảng dưới đây tính toán mức tiêu thụ dự kiến trong ngày cao điểm (mở cổng đăng ký) bao gồm cả tài nguyên tĩnh (HTML/JS/CSS) và API JSON.

| Tài nguyên | Giới hạn Free/tháng | Tiêu thụ dự kiến ngày cao điểm | Dư địa |
| :--- | :--- | :--- | :--- |
| Vercel Bandwidth | 100 GB | **~2 – 3 GB** (Tải trang lần đầu ~1.2GB + API JSON ~750MB) | ✅ Rất an toàn (>97%) |
| Vercel Edge Requests | 1.000.000 | ~30.000 – 50.000 (ngày cao điểm) | ✅ An toàn (>95%) |
| Supabase DB Storage | 500 MB | ~20 MB (3.000 đơn + lịch sử nhiều năm) | ✅ Rất an toàn (>96%) |
| Supabase Connections | 200 (Pooler) | ~50 đồng thời (nhờ Cache lớp 1) | ✅ An toàn |
| Supabase RPC Rate | ~100 req/s | ~50 req/s (đỉnh POST đăng ký) | ⚠️ Cần giám sát khi test |
| GitHub Actions | 2.000 phút/tháng | ~10 phút (10 cron jobs × 1 phút) | ✅ Rất an toàn |

---

## 2. Quy tắc Phối hợp giữa AI và Con người (AI Execution Protocol)

> **CHỈ THỊ BẮT BUỘC DÀNH CHO AI THỰC THI KẾ HOẠCH NÀY:**
> 1. **Điểm dừng Con người (`[HUMAN ACTION REQUIRED]`):** Bất cứ khi nào gặp khối `[HUMAN ACTION REQUIRED]`, AI **PHẢI DỪNG LẠI**, liệt kê rõ các việc cần người dùng thao tác (tạo tài khoản, cấp API Key, cấu hình dashboard bên thứ 3, xác nhận mẫu biểu...) và **chờ người dùng xác nhận hoàn tất** trước khi chuyển sang bước tiếp theo. Không được tự bịa key hoặc bỏ qua bước này.
> 2. **Cổng Kiểm thử (`[QUALITY GATE - KIỂM THỬ]`):** Sau khi hoàn thành toàn bộ task code của một Sprint, AI **BẮT BUỘC** phải thực hiện kiểm thử (viết/chạy test script hoặc hướng dẫn người dùng test thủ công). Chỉ được phép chuyển sang Sprint kế tiếp khi toàn bộ tiêu chí kiểm thử của Sprint hiện tại đều **PASS 100%**.
> 3. **Quy tắc Error Recovery:** Khi gặp lỗi deploy, lỗi SQL, hoặc test fail, AI phải: (a) Ghi nhận lỗi rõ ràng, (b) Thử sửa tối đa 2 lần, (c) Nếu vẫn fail → dừng lại mô tả lỗi chi tiết cho người dùng và đề xuất phương án thay thế. Không được lặp vô hạn.

---

## 3. Bảng tổng hợp Lộ trình 6 Sprint (21 Ngày)

| Sprint | Thời lượng | Trọng tâm | Các bước cần Người dùng thao tác |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Ngày 1 – 3 | Hạ tầng, Database Schema (**8 bảng**), SQL RPC, RLS & Audit Log | Tạo Repo GitHub, Tài khoản Supabase (Singapore), Tài khoản Admin, Kết nối Vercel, Cài GitHub Secrets. |
| **Sprint 2** | Ngày 4 – 7 | Cổng Sinh viên, Edge Cache 3s, Turnstile & Tra cứu | Tạo tài khoản & lấy key Cloudflare Turnstile, Cập nhật `.env`/Vercel, Test trên điện thoại. |
| **Sprint 3** | Ngày 8 – 11 | Admin Auth, Master Data, Bulk Room Generator & Bản đồ phòng | Chốt danh sách tòa nhà/quy ước mã phòng; Test đăng nhập Admin. |
| **Sprint 4** | Ngày 12 – 14 | Admin: Dynamic Form Builder, Cài đặt Hệ thống & Dashboard | Chốt trường Form mở rộng mặc định; Test toàn bộ Zero-Code config. |
| **Sprint 5** | Ngày 15 – 18 | Duyệt đơn, Chuyển phòng, Thanh lý đợt cũ & Import/Export Excel | Cung cấp mẫu Excel tạm trú & danh sách SV mẫu; Kiểm tra file xuất. |
| **Sprint 6** | Ngày 19 – 21 | Stress Test k6, Tối ưu, Tài liệu & Bàn giao | Cài k6, xác nhận chạy test, cấu hình tên miền, nghiệm thu UAT. |

---

## 4. Chi tiết Triển khai từng Sprint

---

### SPRINT 1: Hạ tầng, Cơ sở dữ liệu (8 bảng), SQL RPC & Audit Log (Ngày 1 – 3)

**Mục tiêu:** Dựng xong mã nguồn khung Next.js, **8 bảng** PostgreSQL, các hàm RPC xử lý nguyên tử (Atomic Transactions), bảo mật RLS (chặn bypass Turnstile) và Cron Job chống ngủ đông Database.

#### Bước chuẩn bị tài khoản (Điểm dừng 1.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> Trước khi viết code kết nối và chạy Migration, AI phải hỏi và yêu cầu người dùng hoàn thành các việc sau:
> 1. **GitHub:** Tạo 1 Repository mới (Private hoặc Public) cho dự án và cung cấp đường link repo (hoặc xác nhận đã khởi tạo git local).
> 2. **Supabase:** Đăng ký/Đăng nhập [supabase.com](https://supabase.com) -> Tạo 1 Project mới (**Bắt buộc chọn Region: `Southeast Asia (Singapore)`** để tối ưu tốc độ tại Việt Nam).
> 3. **Cung cấp thông tin kết nối Supabase (để điền vào `.env.local`):**
>    * `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
>    * `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
>    * `SUPABASE_SERVICE_ROLE_KEY` (service_role secret key — tuyệt đối không lộ lên client)
>    * Chuỗi kết nối **Transaction Pooler (Port 6543)** (nếu cần chạy script migration/test).
> 4. **Vercel:** Đăng ký/Đăng nhập [vercel.com](https://vercel.com) (dùng tài khoản GitHub), Import repo dự án để sẵn sàng deploy preview.

#### Danh sách Task kỹ thuật
* **T1.1 — Khởi tạo dự án Next.js:**
  * Khởi tạo Next.js (App Router, TypeScript, Tailwind CSS), cài đặt `shadcn/ui`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`.
  * Thiết lập cấu trúc thư mục rõ ràng: `app/(public)`, `app/admin`, `app/api`, `lib/supabase`, `supabase/migrations`.
  * Cấu hình `next.config.js` với `headers()` bổ sung security headers cơ bản (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).

* **T1.2 — Viết file SQL Migration cho 8 bảng cốt lõi (`supabase/migrations/001_init_schema.sql`):**
  1. `system_config`: `id` (singleton), `is_portal_open` (boolean), `open_at` (timestamptz), `close_at` (timestamptz), `announcement` (text), `dynamic_fields` (JSONB lưu danh sách câu hỏi mở rộng).
  2. `registration_waves`: `id`, `name`, `is_active` (boolean — tạo Partial Unique Index đảm bảo chỉ có tối đa 1 đợt `is_active = true`), `created_at`.
  3. `buildings`: `id`, `code` (UNIQUE, VD: D4, D6, D10), `name`, `is_locked` (boolean), `sort_order` (int).
  4. `amenities`: `id`, `name`, `icon`.
  5. `rooms`: `id`, `building_id` (FK), `floor` (int), `room_code` (UNIQUE), `capacity` (int >= 0), `current_count` (int >= 0), `price` (numeric), `gender_type` (`EMPTY`/`MALE`/`FEMALE`), `fixed_gender` (`NULL`/`MALE`/`FEMALE`), `is_locked` (boolean), `note` (text). Tạo Index trên `(building_id, is_locked, gender_type)`.
  6. `room_amenities`: Junction table gồm `room_id` (FK), `amenity_id` (FK), composite PK. Cho phép query lọc phòng theo tiện ích hiệu quả với Index.
  7. `registrations`: `id`, `wave_id` (FK), `room_id` (FK), `student_code`, `full_name`, `gender` (`MALE`/`FEMALE`), `dob` (date), `extra_data` (JSONB), `status` (`PENDING`/`APPROVED`/`REJECTED`/`CHECKED_OUT`), `reject_reason` (text), `created_at`.
     * ***(VÁ LỖI v2.1)*** Tạo Partial Unique Index trên **`(student_code) WHERE status IN ('PENDING', 'APPROVED')`** (bỏ `wave_id` khỏi khóa duy nhất để 1 sinh viên đang ở KTX từ Đợt 1 không thể đăng ký chiếm thêm giường ở Đợt 2; chỉ khi bị `REJECTED` hoặc đã `CHECKED_OUT` mới được đăng ký lại).
  8. `audit_logs`: `id` (UUID), `actor` (text — tự động đọc `auth.jwt() ->> 'email'` hoặc `'SYSTEM'`), `action` (text), `target_type` (text), `target_id` (UUID), `details` (JSONB), `created_at` (timestamptz DEFAULT `now()`). Index trên `(action, created_at)`.

* **T1.3 — Viết các PostgreSQL RPC Functions (`002_rpc_functions.sql`):**
  * `register_dorm_room(...)`: Dùng `SELECT ... FROM rooms WHERE id = p_room_id FOR UPDATE` khóa mức dòng; kiểm tra đủ 6 điều kiện (cổng mở & trong khung giờ, có đợt active, tòa & phòng không khóa, MSSV chưa có đơn `PENDING`/`APPROVED` nào trên toàn hệ thống, `current_count < capacity`, giới tính khớp hoặc `EMPTY`). Nếu hợp lệ -> Insert đơn `PENDING`, tăng `current_count + 1`, cập nhật `gender_type` nếu đang `EMPTY`. Trả JSON kèm mã lỗi tường minh (`PORTAL_CLOSED`, `NO_ACTIVE_WAVE`, `BUILDING_LOCKED`, `ROOM_LOCKED`, `DUPLICATE_STUDENT`, `ROOM_FULL`, `GENDER_MISMATCH`).
  * `lookup_registration(p_student_code, p_dob)`: Hàm `SECURITY DEFINER` chỉ trả về trạng thái đơn mới nhất của đúng 1 sinh viên khớp cả MSSV và Ngày sinh.
  * `admin_update_registration_status(p_reg_id, p_new_status, p_reason)`: Chuyển trạng thái đơn; tự động trừ `current_count - 1` nếu chuyển sang `REJECTED`/`CHECKED_OUT`; nếu `current_count = 0` và `fixed_gender IS NULL` thì reset `gender_type = 'EMPTY'`. Tự động ghi `audit_logs` với `actor = COALESCE(auth.jwt() ->> 'email', 'ADMIN')`.
  * `admin_transfer_student(p_reg_id, p_target_room_id, p_allow_override)`: Khóa đồng thời 2 dòng phòng theo thứ tự `id ASC` (chống Deadlock), chuyển SV, cập nhật sĩ số/nhãn giới tính cả 2 phòng và ghi `audit_logs`.
  * `admin_add_student_manual(...)`: Xếp SV thủ công, hỗ trợ `p_allow_override` và ghi `audit_logs`.
  * ***(VÁ LỖI v2.1)*** `admin_checkout_wave(p_wave_id)`: Thanh lý hàng loạt toàn bộ đơn `APPROVED`/`PENDING` thuộc đợt `p_wave_id` sang `CHECKED_OUT`, sau đó tự động gọi `recalculate_room_counts()` và ghi `audit_logs` (dùng khi kết thúc năm học).
  * `activate_wave(p_wave_id)`: Tự động deactivate đợt cũ và activate đợt `p_wave_id`.
  * `batch_import_students(p_records JSONB)`: Nhận mảng JSON (tối đa 100 dòng/lần), validate từng dòng trong SQL, insert hàng loạt, đồng bộ sĩ số và trả JSON kết quả từng dòng.
  * ***(VÁ LỖI v2.1)*** `recalculate_room_counts()`: Đồng bộ lại `current_count` và `gender_type` cho toàn bộ 300 phòng bằng cách đếm **tất cả** bản ghi có `status IN ('PENDING', 'APPROVED')` trên toàn bảng `registrations` (không lọc theo `wave_id`).

* **T1.4 — Thiết lập Bảo mật Row Level Security & Quyền RPC (`003_rls_policies.sql`):**
  * Bật RLS cho toàn bộ **8 bảng**.
  * Role `anon`: Chỉ được `SELECT` các bảng công khai (`system_config`, `registration_waves`, `buildings`, `amenities`, `rooms`, `room_amenities`), **cấm đọc trực tiếp `registrations` và `audit_logs`**.
  * ***(VÁ LỖI BẢO MẬT v2.1)*** Chạy `REVOKE EXECUTE ON FUNCTION register_dorm_room, lookup_registration FROM PUBLIC, anon, authenticated;` và chỉ `GRANT EXECUTE ... TO service_role;`. Điều này ép 100% lượt đăng ký/tra cứu phải đi qua API Next.js (có Cloudflare Turnstile), triệt tiêu nguy cơ bot gọi thẳng Supabase RPC.
  * Role `authenticated` (Admin duy nhất): Toàn quyền CRUD các bảng nghiệp vụ và gọi các hàm RPC `admin_*` (lưu ý phía Next.js **bắt buộc dùng Supabase SSR Client mang JWT của Admin** khi gọi `admin_*` để `audit_logs` ghi đúng email Admin). Chỉ được đọc `audit_logs`, cấm sửa/xóa.

* **T1.5 — Tạo GitHub Actions Keep-Alive (`.github/workflows/keep-alive.yml`):**
  * Lập lịch chạy mỗi 3 ngày (`cron: '0 0 */3 * *'`) gửi HTTP GET ping nhẹ tới Supabase REST API (hoặc `/api/health`). Nếu HTTP status ≠ `200`, tự động tạo GitHub Issue với label `critical`.

#### Bước xác nhận Auth & Secrets (Điểm dừng 1.2)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> 1. Chạy các file SQL (`001`, `002`, `003`) trong **Supabase SQL Editor**.
> 2. Vào **Supabase Dashboard -> Authentication -> Providers -> Email**: **Tắt** tùy chọn *"Allow new users to sign up"*.
> 3. Vào **Authentication -> Users -> Add user**: Tạo đúng **1 tài khoản Admin duy nhất** (Email + Mật khẩu mạnh).
> 4. Vào **GitHub Repo -> Settings -> Secrets -> Actions**: Thêm `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
> 5. Thêm các biến môi trường vào **Vercel Project Settings -> Environment Variables**.

#### [QUALITY GATE - KIỂM THỬ SPRINT 1]
AI viết và chạy script test tự động (`scripts/test-sprint1.mjs`) và xác nhận đạt toàn bộ tiêu chí:
1. **Test Race Condition:** Bắn song song 50 request (`Promise.all` qua `service_role`) vào `register_dorm_room` cho 1 phòng 6 chỗ (trộn Nam, Nữ, trùng MSSV) → Đúng 6 đơn thành công, cùng giới tính, `current_count = 6`, 44 lỗi nghiệp vụ chuẩn xác.
2. **Test Bảo mật RLS & Chống Bypass Turnstile *(MỚI)*:** Dùng `ANON_KEY` thử `SELECT * FROM registrations`, `SELECT * FROM audit_logs`, và **gọi trực tiếp `rpc('register_dorm_room', ...)`** → Tất cả phải bị từ chối (`401`/`403`/`permission denied`).
3. **Test Ràng buộc liên đợt *(MỚI)*:** SV đã `APPROVED` ở Đợt 1 thử đăng ký lại ở Đợt 2 → Bị chặn (`DUPLICATE_STUDENT`).
4. **Test Audit Log & Keep-Alive:** Xác nhận `audit_logs` ghi đúng email Admin; chạy tay GitHub Actions Keep-Alive báo xanh (`200 OK`).

---

### SPRINT 2: Cổng Sinh viên, Edge Cache 3 giây & Tra cứu kết quả (Ngày 4 – 7)

**Mục tiêu:** Hoàn thiện giao diện đăng ký & tra cứu tối ưu cho điện thoại, triển khai Edge Cache 3s (không bị phá cache) + Nút làm mới có Cooldown + Cloudflare Turnstile.

#### Bước chuẩn bị Cloudflare Turnstile (Điểm dừng 2.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> 1. Đăng ký/Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) -> **Turnstile -> Add widget** (thêm domain `localhost` và domain `.vercel.app`, chọn Mode: **Managed**).
> 2. Điền `NEXT_PUBLIC_TURNSTILE_SITE_KEY` và `TURNSTILE_SECRET_KEY` vào `.env.local` và Vercel Environment Variables.

#### Danh sách Task kỹ thuật
* **T2.1 — Xây dựng các Public API Routes:**
  * `GET /api/public/rooms`: Lấy `system_config`, `active_wave`, `buildings`, `amenities`, `rooms` (kèm danh sách `amenity_ids` đã join từ `room_amenities`). Chỉ select các cột cần thiết (`< 50KB`). Gắn header `Cache-Control: public, s-maxage=3, stale-while-revalidate=5`. ***(VÁ LỖI v2.1)*** Bỏ qua hoàn toàn mọi query string nếu client cố tình truyền vào.
  * `POST /api/public/register`:
    * Kiểm tra `Content-Length`, từ chối nếu payload `> 10KB`.
    * Xác thực `turnstileToken` với Cloudflare API (chỉ cho phép bypass trong Sprint 6 nếu có `LOAD_TEST_BYPASS_SECRET`).
    * Validate dữ liệu bằng `Zod` (bao gồm các trường động trong `system_config.dynamic_fields`).
    * Dùng Supabase Client khởi tạo bằng **`SUPABASE_SERVICE_ROLE_KEY`** gọi RPC `register_dorm_room` và trả thông báo tiếng Việt.
  * `POST /api/public/lookup`: Xác thực Turnstile -> Dùng `service_role` gọi RPC `lookup_registration(student_code, dob)` -> Trả kết quả.

* **T2.2 — Giao diện Trang chủ & Bộ lọc phòng (Mobile-First):**
  * Header hiển thị tên đợt, thông báo từ Admin, đồng hồ đếm ngược nếu cổng chưa mở (`open_at > now`) hoặc banner nếu cổng đóng.
  * Bộ lọc Client-side tức thì: Tòa nhà, Giới tính phòng (Tất cả / Nam / Nữ / Phòng trống), Tiện ích (multi-select), nút gạt "Chỉ hiện phòng còn trống", ô tìm nhanh mã phòng.
  * Thẻ phòng (Card) nhóm theo `Tòa -> Tầng`, hiển thị màu giới tính, sĩ số (`4/6`), giá, tag tiện ích, trạng thái Khóa/Đầy.
  * Nút **"Cập nhật phòng trống"** nổi (sticky) kèm Cooldown `3s -> 2s -> 1s` và dòng *"Cập nhật lần cuối: HH:MM:SS"*.
  * ***(VÁ LỖI v2.1)*** Nút làm mới gọi `fetch('/api/public/rooms', { cache: 'no-store' })` và **tuyệt đối không gắn `?t=Date.now()`** để đảm bảo 100% ăn Edge Cache 3 giây của Vercel.

* **T2.3 — Modal Phiếu đăng ký động & Xử lý lỗi thông minh:**
  * Render 4 trường cứng (`Họ và tên`, `MSSV`, `Giới tính`, `Ngày sinh`) + các trường động từ `dynamic_fields`.
  * Cảnh báo ngay trên Form nếu giới tính SV khác giới tính phòng. Nhúng Cloudflare Turnstile.
  * Khi nhận lỗi `ROOM_FULL`, `ROOM_LOCKED`, `GENDER_MISMATCH`: Hiển thị Toast tiếng Việt + **cập nhật nóng State trình duyệt** khóa ngay phòng đó + kích hoạt làm mới danh sách.
  * Khi mất kết nối/timeout: Hiển thị *"Không rõ kết quả, vui lòng kiểm tra ở mục Tra cứu trước khi thử lại"*.
  * Màn hình xác nhận thành công có nút chụp ảnh/lưu thông tin và chuyển sang Tab Tra cứu.

* **T2.4 — Trang Tra cứu kết quả (`/tra-cuu`):**
  * Form nhập `MSSV` + `Ngày sinh` + Turnstile -> Hiển thị thẻ kết quả (`Chờ duyệt` / `Đã duyệt` / `Bị từ chối` kèm lý do).

#### [QUALITY GATE - KIỂM THỬ SPRINT 2]
> **[HUMAN ACTION REQUIRED — KIỂM THỬ TRÊN VERCEL PREVIEW & ĐIỆN THOẠI]**
> 1. **Kiểm chứng Edge Cache 3s:** Mở Chrome DevTools (Network) trên Vercel Preview, bấm "Cập nhật phòng trống" hoặc tải `/api/public/rooms` liên tục → Request đầu `x-vercel-cache: MISS`, các request trong 3 giây sau phải trả về `x-vercel-cache: HIT` (`< 100ms`), URL không có query string lạ.
> 2. **Kiểm chứng luồng Trễ Cache (2 tab ẩn danh):** 2 tab cùng mở phòng còn 1 chỗ, SV A gửi trước, 1s sau SV B gửi → SV A thành công, SV B nhận thông báo "Phòng vừa đầy" và thẻ phòng lập tức đổi trạng thái Đầy không cần F5.
> 3. **Kiểm chứng Mobile UX & Mất kết nối:** Test trực tiếp trên điện thoại thật; test bật Offline mode trong DevTools khi bấm gửi đơn.

---

### SPRINT 3: Cổng Admin — Auth, Master Data & Quản lý 300 Phòng (Ngày 8 – 11)

**Mục tiêu:** Xây dựng khung Admin, xác thực 1 tài khoản duy nhất, quản lý danh mục động và công cụ tạo/quản lý 300 phòng hàng loạt.

#### Bước chốt quy ước nghiệp vụ ban đầu (Điểm dừng 3.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> 1. Quy ước đặt mã phòng của KTX khách hàng là gì? (VD: `201D10`, `201D11A` hay `D10-201`?).
> 2. Danh sách tòa nhà/dãy cụ thể và số tầng mỗi tòa (để AI seed data test).

#### Danh sách Task kỹ thuật
* **T3.1 — Hệ thống Xác thực Admin & Middleware bảo vệ:**
  * Trang `/admin/login` (Supabase Auth), `middleware.ts` bảo vệ `/admin/*` và `/api/admin/*`.
  * Layout Sidebar: `Tổng quan`, `Quản lý Phòng`, `Xét duyệt Đơn`, `Đợt đăng ký`, `Cài đặt Hệ thống & Form`, `Nhật ký hoạt động`, `Đăng xuất`.
  * Tự động refresh session token và cảnh báo khi phiên sắp hết hạn.

* **T3.2 — Module Danh mục động (Master Data):**
  * Quản lý **Tòa nhà/Dãy** (CRUD, sắp xếp, nút gạt khóa nhanh cả tòa).
  * Quản lý **Tiện ích** (CRUD tag tiện ích).
  * Quản lý **Đợt đăng ký (Waves)** (Tạo đợt mới, nút `Set Active` gọi RPC `activate_wave`, xem lịch sử đợt cũ).

* **T3.3 — Module Trình tạo phòng hàng loạt & Bản đồ 300 phòng:**
  * **Bulk Room Generator:** Chọn Tòa, mẫu tên phòng (`{floor}{num}{building}`), khoảng tầng, số phòng/tầng, sức chứa, giá, tiện ích -> Preview -> Tạo hàng loạt.
  * **Bản đồ 300 phòng:** Nhóm theo `Tòa -> Tầng`, mã màu trực quan (Xanh = trống, Đỏ = đầy, Vàng = vượt sức chứa, Xám = khóa), tìm kiếm nhanh.
  * **Thao tác hàng loạt (Bulk Actions):** Khóa/Mở phòng, Gán/Gỡ tiện ích, Cập nhật giá/sức chứa, Cố định cứng giới tính (`fixed_gender`).
  * **Drawer chi tiết phòng:** Sửa sức chứa (cho phép `0`), ghi chú thiết bị, xem danh sách SV đang ở.

#### [QUALITY GATE - KIỂM THỬ SPRINT 3]
1. **Test phân quyền:** Tab ẩn danh vào `/admin/rooms` hoặc gọi `POST /api/admin/rooms` → Bị chặn (`401`/redirect login).
2. **Test tạo 300 phòng hàng loạt:** Tạo 300 phòng trong `< 5 giây`, không trùng mã, hiển thị mượt.
3. **Test Khóa hàng loạt & Activate Wave:** Khóa tầng 2 tòa D10 → phía SV lập tức không đăng ký được; bấm `Set Active` đợt 2 → đợt 1 tự động tắt.

---

### SPRINT 4: Admin — Dynamic Form Builder, Cài đặt Hệ thống & Dashboard (Ngày 12 – 14)

**Mục tiêu:** Hoàn thiện cấu hình Zero-Code, trang Tổng quan KPI và Nhật ký hoạt động.

#### Bước chốt trường form mở rộng (Điểm dừng 4.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> Ngoài `Họ tên`, `MSSV`, `Giới tính`, `Ngày sinh`, khách hàng muốn cài đặt sẵn các trường mở rộng mặc định nào (VD: `Số điện thoại`, `Lớp/Khoa`, `Diện ưu tiên`, `CCCD`) để có sẵn khi bàn giao?

#### Danh sách Task kỹ thuật
* **T4.1 — Cài đặt Hệ thống & Dynamic Form Builder (Zero-Code):**
  * Bật/tắt cổng thủ công + hẹn giờ tự động mở/đóng (`open_at`, `close_at`), soạn thông báo trang chủ.
  * **Dynamic Form Builder:** Thêm/Sửa/Xóa/Sắp xếp câu hỏi động (`Text`, `Number`, `Dropdown`, `Checkbox`, bật/tắt `Bắt buộc`) kèm **Preview Live** ngay bên cạnh.
* **T4.2 — Trang Tổng quan (Admin Dashboard):**
  * Thẻ KPI (Tổng phòng, Sức chứa, Đã lấp đầy %, Đơn chờ duyệt), biểu đồ tỷ lệ lấp đầy theo tòa nhà, 10 hoạt động gần nhất từ `audit_logs`.
* **T4.3 — Trang Nhật ký hoạt động (`/admin/audit-logs`):**
  * Bảng phân trang lọc theo hành động & thời gian, xem chi tiết JSON snapshot trước/sau.

#### [QUALITY GATE - KIỂM THỬ SPRINT 4]
1. **Test Zero-Code Form Builder:** Thêm 2 trường mới → Mở trang SV sau 3 giây thấy 2 trường mới hoạt động, điền gửi đi và Admin đọc lại chuẩn xác.
2. **Test Dashboard & Đóng/Mở cổng hẹn giờ:** Đóng cổng → SV thấy banner đóng; hẹn giờ đóng sau 5 phút → hết giờ tự chặn đăng ký; `audit_logs` ghi đủ lịch sử.

---

### SPRINT 5: Nghiệp vụ Xét duyệt, Chuyển phòng & Import/Export Excel (Ngày 15 – 18)

**Mục tiêu:** Hoàn thiện toàn bộ quy trình vận hành hằng ngày, thanh lý cuối năm và nhập/xuất Excel chuẩn tiếng Việt.

#### Bước xác nhận mẫu biểu Excel (Điểm dừng 5.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> 1. Xác nhận danh sách cột cho **File khai báo tạm trú gửi công an** và **Danh sách thành viên KTX**.
> 2. Cung cấp file Excel mẫu danh sách SV khóa cũ (nếu có) để căn chỉnh cột Import.

#### Danh sách Task kỹ thuật
* **T5.1 — Module Xét duyệt Đơn đăng ký:**
  * Bảng lọc theo Đợt, Trạng thái, Tòa, Phòng, Giới tính, tìm kiếm Tên/MSSV; xem chi tiết `extra_data`.
  * Duyệt đơn lẻ / hàng loạt (`APPROVED`), Từ chối (`REJECTED` kèm lý do), Thanh lý/Trả phòng (`CHECKED_OUT`).
  * Hiển thị badge "Vượt sức chứa" nếu `current_count > capacity`.
* **T5.2 — Xếp phòng thủ công, Chuyển phòng & Thanh lý đợt cũ:**
  * **Thêm SV thủ công:** Có checkbox "Cho phép vượt sức chứa chuẩn" (Admin Override).
  * **Chuyển phòng (Transfer):** Gọi RPC `admin_transfer_student`, có Confirm dialog kép nếu chuyển khác giới tính hoặc vượt sức chứa.
  * ***(VÁ LỖI v2.1)*** **Thanh lý hàng loạt theo đợt cũ:** Nút bấm trong trang Quản lý Đợt (có hộp thoại xác nhận nhập chữ `XAC NHAN`) gọi RPC `admin_checkout_wave(wave_id)` để chuyển toàn bộ SV của năm học cũ sang `CHECKED_OUT` và làm sạch 300 phòng đón năm học mới.
* **T5.3 — Module Import Excel (Chunked Batch Import):**
  * Nút tải file Excel mẫu (`.xlsx`).
  * Đọc & Validate trên trình duyệt bằng `SheetJS` (Preview xanh/đỏ từng dòng lỗi).
  * Gửi từng batch **50–100 dòng/request** gọi RPC `batch_import_students` kèm Progress Bar (tránh timeout 10s của Vercel). Kết thúc gọi `recalculate_room_counts()` và hiện báo cáo tổng hợp.
* **T5.4 — Module Export Excel & 1-Click Backup:**
  * Xuất **Danh sách SV theo phòng** (kèm trường động, chuẩn UTF-8, ngày `DD/MM/YYYY`).
  * Xuất **File tạm trú gửi công an**.
  * Xuất **Full Backup** (nhiều sheet: Tòa nhà, Phòng, Đăng ký, Cấu hình, Nhật ký hoạt động).

#### [QUALITY GATE - KIỂM THỬ SPRINT 5]
1. **Test Toàn vẹn Dữ liệu:** Chạy chuỗi liên hoàn: Đăng ký Nam → Duyệt → Chuyển phòng → Đăng ký Nữ vào phòng cũ → Từ chối → Thêm thủ công vượt sức chứa (7/6) → Thanh lý đợt cũ → Kiểm tra `rooms.current_count` và `gender_type` khớp 100% ở mọi bước, `audit_logs` ghi đủ.
2. **Test Import 1.000 dòng Excel:** Gài 5 dòng lỗi → Preview bắt đúng 5 lỗi; sau khi sửa, Chunked Batch Import chạy xong trong `< 30 giây` không timeout.
3. **Test Export Excel thực tế:**
   > **[HUMAN ACTION REQUIRED]** Người dùng mở 3 file Excel xuất ra trên **Microsoft Excel (Windows)** xác nhận không lỗi font tiếng Việt và đúng định dạng ngày tháng.

---

### SPRINT 6: Stress Test k6, Tối ưu, Tài liệu & Bàn giao (Ngày 19 – 21)

**Mục tiêu:** Chứng minh bằng số liệu định lượng hệ thống chịu được lưu lượng 3.000 sinh viên trên gói Free, gỡ sạch backdoor test và bàn giao vận hành.

#### Bước chuẩn bị chạy Stress Test (Điểm dừng 6.1)
> **[HUMAN ACTION REQUIRED — AI PHẢI DỪNG VÀ HỎI NGƯỜI DÙNG]**
> 1. Cài đặt **k6** trên máy (`winget install k6 --source winget`).
> 2. Thêm tạm biến môi trường `LOAD_TEST_BYPASS_SECRET` trên Vercel (sẽ **xóa bỏ hoàn toàn** sau khi test xong).
> 3. Mở sẵn **Supabase Dashboard (Database Health)** và **Vercel Dashboard (Usage)** để theo dõi thực tế.

> [!CAUTION]
> `LOAD_TEST_BYPASS_SECRET` là backdoor tạm thời. Bắt buộc hoàn thành checklist xóa ở **T6.3** trước khi Go-Live.

#### Danh sách Task kỹ thuật
* **T6.1 — Viết kịch bản Load Testing (`tests/load-test.js` dùng k6):**
  * ***(VÁ LỖI v2.1)*** Dùng executor `ramping-arrival-rate` (kiểm soát trực tiếp số request/giây) cho Kịch bản A và C để mô phỏng chính xác 3.000 SV mà không làm nghẽn cổng mạng/NAT trên máy tính cá nhân:
    * **Kịch bản A (Cơn bão F5 — Read Heavy):** Tăng lên **300 req/s** vào `GET /api/public/rooms` trong 60 giây (tương đương 18.000 lượt F5 từ 3.000 SV).
    * **Kịch bản B (Tranh giành cực hạn — Extreme Contention):** **200 VUs** bắn đồng thời `POST /api/public/register` vào **duy nhất 1 phòng 6 chỗ** trong 5 giây.
    * **Kịch bản C (Mô phỏng ngày mở cổng thật — Mixed Workload):** Ramp-up lên **150 req/s đọc + 30 req/s ghi** liên tục trong 3 phút (tương đương 3.000 SV vừa xem phòng vừa chốt đơn).
* **T6.2 — Chạy Stress Test, Phân tích & Tinh chỉnh:**
  * Chạy lần lượt A -> B -> C, ghi nhận `5xx`, `p95`, CPU Supabase, Active Connections, Vercel Bandwidth.
  * Lưu kết quả + ảnh chụp dashboard vào `docs/STRESS_TEST_REPORT.md`.
* **T6.3 — Làm sạch & Khóa Production (Go-Live Prep):**
  * **Checklist bắt buộc xóa bypass:**
    - [ ] Xóa `LOAD_TEST_BYPASS_SECRET` khỏi Vercel Environment Variables.
    - [ ] Gỡ bỏ code bypass trong `/api/public/register` (kiểm tra bằng `grep -r "BYPASS" src/` trả về rỗng).
    - [ ] Deploy lại bản production sạch.
    - [ ] Test gọi `POST /api/public/register` không có Turnstile token → 100% bị từ chối.
  * Xóa toàn bộ dữ liệu test rác trong Database.
* **T6.4 — Viết Tài liệu Hướng dẫn (`docs/ADMIN_GUIDE.md`):**
  * Hướng dẫn 7 quy trình vận hành chuẩn (Tạo đợt mới, Tạo/Khóa 300 phòng, Sửa Form động, Import/Duyệt/Chuyển phòng/Export, Thanh lý cuối năm & Backup, Xem Nhật ký, Khắc phục sự cố khi DB auto-pause hoặc quên mật khẩu).

#### [QUALITY GATE - KIỂM THỬ NGHIỆM THU GO-LIVE (SPRINT 6)]
1. **Tiêu chí Stress Test k6:**
   * **Kịch bản A (300 req/s đọc):** Lỗi `5xx` = `0%`, `p95 < 500ms`, CPU Supabase `< 40%`.
   * **Kịch bản B (200 VUs tranh 1 phòng 6 chỗ):** Đúng **6 đơn thành công**, **194 lỗi nghiệp vụ**, **0 lỗi `500`/`504`**, sĩ số phòng = `6/6`.
   * **Kịch bản C (Mixed 3 phút):** Tổng tài nguyên tiêu thụ `< 15%` hạn mức Free Tier.
2. **Xác nhận bảo mật:** Gọi `POST /api/public/register` không có token Turnstile → bị chặn 100%.
3. **Nghiệm thu UAT & Bàn giao:**
   > **[HUMAN ACTION REQUIRED — BƯỚC CUỐI CÙNG VỚI KHÁCH HÀNG]**
   > 1. Nếu có tên miền riêng, trỏ DNS về Vercel và thêm domain vào **Cloudflare Turnstile**.
   > 2. Để đại diện Ban Quản lý KTX tự thao tác khép kín 1 vòng (tạo phòng, khóa phòng, thêm câu hỏi form, đăng ký bằng điện thoại, duyệt đơn, xuất Excel).
   > 3. Bàn giao tài khoản Admin, `ADMIN_GUIDE.md`, `STRESS_TEST_REPORT.md` và quyền quản trị hạ tầng.

---

## 5. Phụ lục: Danh sách Biến môi trường (`.env.local` & Vercel)

| Tên biến môi trường | Nguồn lấy | Scope (Vercel) | Ghi chú |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Project Settings -> API | Client & Server | Công khai được |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase -> Project Settings -> API | Client & Server | Chỉ đọc bảng công khai (đã khóa RPC ghi) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Project Settings -> API | **Chỉ Server** | Dùng gọi RPC `register_dorm_room` & `lookup_registration` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Dashboard -> Turnstile | Client & Server | Công khai được |
| `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard -> Turnstile | **Chỉ Server** | Dùng verify token phía server |
| `LOAD_TEST_BYPASS_SECRET` | Tự đặt ngẫu nhiên | **Tạm thời (Sprint 6)** | **Bắt buộc xóa trước khi Go-Live** |

### 5.2. Cấu trúc thư mục dự án đề xuất

```
ktx-hanu/
├── app/
│   ├── (public)/           # Cổng Sinh viên
│   │   ├── page.tsx        # Trang chủ, bộ lọc, danh sách phòng
│   │   └── tra-cuu/        # Trang tra cứu kết quả
│   ├── admin/              # Cổng Admin (bảo vệ bởi middleware)
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── rooms/
│   │   ├── registrations/
│   │   ├── waves/
│   │   ├── settings/
│   │   └── audit-logs/
│   └── api/
│       ├── public/         # Routes công khai (Turnstile + service_role)
│       │   ├── rooms/
│       │   ├── register/
│       │   └── lookup/
│       ├── admin/          # Routes Admin (JWT authenticated)
│       └── health/         # Keep-Alive ping endpoint
├── lib/
│   └── supabase/           # Client helpers (anon + service_role + SSR)
├── supabase/
│   └── migrations/
│       ├── 001_init_schema.sql
│       ├── 002_rpc_functions.sql
│       └── 003_rls_policies.sql
├── tests/
│   ├── load-test.js        # k6 stress test (3 kịch bản)
│   └── test-sprint1.mjs    # Race condition + RLS test
├── docs/
│   ├── ADMIN_GUIDE.md
│   └── STRESS_TEST_REPORT.md
└── .github/
    └── workflows/
        └── keep-alive.yml

```

### 5.3. Lịch sử thay đổi đầy đủ (v1 → FINAL)

| # | Hạng mục | v1 (gốc) | v2.0 | v2.1 / FINAL | Lý do |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Timeline** | 14 ngày / 5 Sprint | **21 ngày / 6 Sprint** | ← Giữ | Sprint 3 Admin panel quá nặng; cần buffer fix bug |
| 2 | **Schema amenities** | `amenity_ids UUID[]` trong `rooms` | **Junction table `room_amenities`** | ← Giữ | Chuẩn hóa DB; query ngược "phòng có điều hòa" hiệu quả |
| 3 | **Audit Log** | Không có | **Bảng `audit_logs` + trang Nhật ký** | ← Giữ | Nghiệp vụ KTX cần trace thao tác Admin |
| 4 | **Import Excel** | 1 request duy nhất | **Chunked batch 50–100 dòng/request** | ← Giữ | Tránh Vercel function timeout 10 giây |
| 5 | **Activate Wave** | Partial Unique Index | **RPC `activate_wave`** tự deactivate đợt cũ | ← Giữ | Tránh race condition khi Admin bấm nhanh |
| 6 | **Stress Test contention** | 500 VUs | **200 VUs** | ← Giữ | Phù hợp Supabase free tier rate limit ~100 req/s |
| 7 | **Error Recovery** | Không có | **Error Recovery Protocol** (thử 2 lần → dừng) | ← Giữ | Tránh AI lặp vô hạn khi lỗi |
| 8 | **Security** | Chỉ Turnstile + RLS | **+ Headers + payload check** | **+ REVOKE EXECUTE từ `anon`** | Vá lỗ hổng bot gọi thẳng RPC bỏ qua Turnstile |
| 9 | **UNIQUE(student_code)** | Per-wave `(wave_id, student_code)` | ← Giữ | **Toàn hệ thống `(student_code)` WHERE PENDING/APPROVED** | Chặn SV đang ở KTX đợt 1 đăng ký thêm chỗ ở đợt 2 |
| 10 | **Edge Cache** | Không rõ cách refresh | Đề cập `no-store` | **Cấm hẳn `?t=Date.now()`** | Query string tạo URL mới → CDN luôn MISS → phá cache |
| 11 | **k6 executor** | `shared-iterations` / VUs | VUs | **`ramping-arrival-rate` (req/s)** | VUs trên 1 máy bị bottleneck mạng/NAT; req/s mô phỏng chính xác hơn |
| 12 | **Stress Test metric** | 3.000 VUs đọc | 3.000 VUs | **300 req/s đọc** (tương đương 3.000 SV) | Cùng lý do với #11 |
| 13 | **Thanh lý cuối năm** | Thanh lý thủ công từng đơn | Thủ công từng đơn | **RPC `admin_checkout_wave` + nút UI** | Vận hành thực tế: cuối năm học có hàng nghìn đơn cần chuyển |
| 14 | **`recalculate_room_counts`** | Không có | Có (đếm per-wave) | **Đếm toàn bảng (không lọc wave_id)** | Phòng có thể có SV từ nhiều đợt khác nhau cùng tồn tại |
| 15 | **Free Tier Monitor** | Không có | Bảng ngưỡng an toàn | **Bảng mở rộng (tính cả bandwidth tĩnh)** | Minh bạch con số thực tế hơn |
| 16 | **Tài liệu bàn giao** | `ADMIN_GUIDE.md` cơ bản | **+ Troubleshooting** | **+ `STRESS_TEST_REPORT.md` + Cấu trúc thư mục** | Bàn giao chuyên nghiệp, dễ maintain lâu dài |