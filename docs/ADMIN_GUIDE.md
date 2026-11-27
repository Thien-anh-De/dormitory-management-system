# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRỰC TUYẾN (DÀNH CHO BAN QUẢN LÝ)

Tài liệu này hướng dẫn chi tiết từng bước vận hành hệ thống Ký túc xá trên giao diện Quản trị (`/admin/login`) mà **không cần can thiệp mã nguồn**.

---

## 1. Đăng nhập Trang Quản trị
1. Truy cập địa chỉ: `<ten-mien-cua-ban>/admin/login`.
2. Nhập **Email** và **Mật khẩu** của tài khoản Admin duy nhất.
3. Sau khi đăng nhập, thanh menu bên trái gồm 6 mục: **Tổng quan**, **Quản lý Phòng**, **Xét duyệt Đơn**, **Đợt đăng ký**, **Cài đặt & Form**, **Nhật ký hoạt động**.

---

## 2. Tạo Đợt đăng ký mới & Cài giờ mở cổng
1. Vào mục **Đợt đăng ký** (`/admin/waves`):
   * Nhập tên đợt (VD: `HK1 2026-2027`) → bấm **Tạo đợt mới**.
   * Bấm nút **Set Active** ở đợt muốn mở cho sinh viên đăng ký *(hệ thống tự động tắt đợt cũ)*.
2. Vào mục **Cài đặt & Form** (`/admin/settings`):
   * Bật ô **Mở cổng đăng ký cho sinh viên**.
   * *(Tùy chọn)* Đặt **Tự động mở từ lúc** và **Tự động đóng vào lúc**.
   * Nhập **Thông báo** hiển thị trên trang chủ sinh viên → bấm **Lưu cấu hình**.

---

## 3. Tạo 300 Phòng hàng loạt, Khóa phòng & Sửa tiện ích
1. Vào mục **Quản lý Phòng** (`/admin/rooms`) → chuyển sang tab **Tòa nhà & Tiện ích** để tạo trước các tòa nhà (VD: `D4`, `D6`, `D10`) và các tag tiện ích (VD: `Điều hòa`, `Nóng lạnh`, `Khép kín`).
2. Quay lại tab **Bản đồ phòng** → bấm **Tạo phòng hàng loạt**:
   * Chọn Tòa nhà, mẫu mã phòng (VD: `{floor}{num}{building}` → `201D10`), khoảng tầng, số phòng mỗi tầng, sức chứa, giá tiền, tiện ích.
   * Xem trước danh sách mã phòng → bấm **Tạo phòng**.
3. **Thao tác hàng loạt:** Tích chọn nhiều ô phòng (hoặc bấm **Chọn tầng** / **Chọn cả tòa**) → dùng thanh công cụ hiện ra để **Khóa/Mở phòng**, **Đổi giá**, **Đổi sức chứa**, **Gán/Gỡ tiện ích**, hoặc **Cố định giới tính**.
4. **Sửa chi tiết 1 phòng:** Bấm thẳng vào tên mã phòng (VD: `201D10`) để mở ngăn kéo bên phải: sửa sức chứa về `0` nếu phòng đang bảo trì/làm kho, ghi chú tình trạng thiết bị, hoặc xem danh sách sinh viên đang ở.

---

## 4. Thêm/Bớt câu hỏi trên Phiếu đăng ký (Zero-Code)
1. Vào mục **Cài đặt & Form** (`/admin/settings`).
2. Ở phần **Câu hỏi mở rộng trên Phiếu đăng ký**:
   * Bấm **+ Thêm trường** để thêm câu hỏi mới (chọn kiểu `Text`, `Number`, `Dropdown`, hoặc `Checkbox`).
   * Tích chọn **Bắt buộc sinh viên phải điền/chọn** nếu muốn bắt buộc.
   * Dùng mũi tên lên/xuống để sắp xếp thứ tự.
   * Kiểm tra khung **Xem trước (Live Preview)** bên phải → bấm **Lưu cấu hình**.

---

## 5. Xét duyệt Đơn, Chuyển phòng, Import & Export Excel
Vào mục **Xét duyệt Đơn** (`/admin/registrations`):
* **Duyệt đơn:** Tích chọn nhiều đơn rồi bấm **Duyệt hàng loạt**, hoặc bấm nút **Duyệt / Từ chối** (nhập lý do) trên từng dòng. *(Khi từ chối, hệ thống tự động trả lại 1 chỗ trống).*
* **Chuyển phòng:** Bấm **Chuyển** trên dòng sinh viên → chọn phòng đích → xác nhận.
* **Thêm SV thủ công / Ghi đè vượt sức chứa:** Bấm **+ Thêm SV thủ công**, tích chọn *"Cho phép vượt sức chứa chuẩn"* nếu cần xếp thêm người vào phòng đã đầy.
* **Import SV khóa cũ từ Excel:** Bấm **Import Excel** → tải file mẫu `.xlsx` → điền danh sách → chọn file để hệ thống kiểm tra lỗi từng dòng → bấm **Import**.
* **Xuất báo cáo Excel:**
  * **Xuất DS phòng:** Danh sách sinh viên nhóm theo từng tòa/phòng (kèm đủ các trường động).
  * **Xuất Tạm trú CA:** File khai báo tạm trú chuẩn gửi công an.
  * **1-Click Backup:** Tải về file Excel gồm 5 sheet sao lưu toàn bộ dữ liệu hệ thống.

---

## 6. Kết thúc Năm học (Thanh lý hàng loạt)
1. Trước khi bước vào năm học mới, vào **Đợt đăng ký** (`/admin/waves`).
2. Bấm **Thanh lý đợt** tại đợt của năm học cũ → nhập chữ `XAC NHAN` → hệ thống sẽ chuyển toàn bộ sinh viên cũ sang trạng thái `Đã trả phòng` và đặt lại sĩ số các phòng về trống.
3. Sau đó bấm **1-Click Backup** để lưu trữ hồ sơ năm cũ về máy tính.

---

## 7. Xem Nhật ký hoạt động & Khắc phục sự cố
* **Xem lịch sử thao tác:** Vào **Nhật ký hoạt động** (`/admin/audit-logs`) để tra cứu ai đã duyệt đơn, chuyển phòng, ghi đè hoặc sửa cấu hình vào thời điểm nào.
* **Sự cố 1 — Database bị tạm dừng (Auto-Pause):** Hệ thống đã có GitHub Actions tự động ping mỗi 3 ngày để giữ DB luôn chạy. Nếu vì lý do bất khả kháng DB bị tạm dừng, đăng nhập [supabase.com](https://supabase.com) → chọn Project → bấm **Restore / Resume project** và chờ 2 phút.
* **Sự cố 2 — Quên mật khẩu Admin:** Đăng nhập [supabase.com](https://supabase.com) → **Authentication → Users** → bấm vào tài khoản Admin → chọn **Reset password / Update password**.
* **Sự cố 3 — Kiểm tra hạn mức miễn phí:** Vào [vercel.com](https://vercel.com) → tab **Usage** (kiểm tra Bandwidth/Edge Requests) và [supabase.com](https://supabase.com) → **Project Settings → Usage**.
