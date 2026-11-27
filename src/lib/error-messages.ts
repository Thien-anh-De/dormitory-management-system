const ERROR_MESSAGES: Record<string, string> = {
  PORTAL_CLOSED: "Cổng đăng ký hiện đang đóng hoặc chưa đến thời gian mở cổng.",
  NO_ACTIVE_WAVE: "Hiện chưa có đợt đăng ký ký túc xá nào đang mở.",
  BUILDING_LOCKED: "Tòa nhà này hiện đang tạm khóa đăng ký.",
  ROOM_LOCKED: "Phòng này hiện đang tạm khóa. Vui lòng chọn phòng khác.",
  ROOM_NOT_FOUND: "Không tìm thấy thông tin phòng đã chọn.",
  DUPLICATE_STUDENT:
    "Mã sinh viên này đã có đơn đăng ký đang chờ duyệt hoặc đã được xếp phòng trong hệ thống.",
  ROOM_FULL: "Phòng vừa hết chỗ trống. Vui lòng chọn phòng khác!",
  GENDER_MISMATCH:
    "Giới tính của bạn không phù hợp với giới tính hiện tại của phòng này.",
  INVALID_INPUT: "Thông tin nhập vào chưa hợp lệ. Vui lòng kiểm tra lại.",
  TURNSTILE_FAILED:
    "Xác thực chống spam (Cloudflare Turnstile) thất bại. Vui lòng tải lại và thử lại.",
  PAYLOAD_TOO_LARGE: "Dữ liệu gửi lên vượt quá dung lượng cho phép.",
};

/** Map an internal RPC/API error code to a user-friendly Vietnamese message. */
export function getVietnameseErrorMessage(code?: string): string {
  if (!code) return "Có lỗi xảy ra. Vui lòng thử lại sau.";
  return ERROR_MESSAGES[code] ?? "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.";
}
