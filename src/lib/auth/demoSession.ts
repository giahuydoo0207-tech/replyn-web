/**
 * Việc cần làm ngay sau khi đăng nhập Nova của từng tab, chỉ dùng sessionStorage (không chia sẻ giữa các tab):
 * cuộc trò chuyện cần mở và một thông báo hiển thị một lần. Danh tính và vai trò luôn đến từ cookie phiên do
 * server ký, không bao giờ từ đây. Dữ liệu chat vẫn là reducer mock trong bộ nhớ.
 */
/** Khóa vai trò của bản QR thử nghiệm cũ; chỉ còn để dọn dữ liệu tab cũ. */
const LEGACY_ROLE_KEY = "replyn.auth.role";
const PENDING_KEY = "replyn.auth.pending";

export interface PendingLogin {
  /** null: mở danh sách chat */
  conversationId: string | null;
  notice: string | null;
  /** Cuộc trò chuyện chỉ là mặc định; workspace thật từ Nova (nếu có) được ưu tiên mở. */
  fallback: boolean;
}

function get(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage bị chặn: bỏ qua, app vẫn chạy với vai trò mặc định
  }
}

/** Gọi khi server đã đặt cookie phiên, ngay trước khi chuyển sang màn chat. */
export function queuePendingLogin(conversationId: string | null, notice?: string, fallback = false) {
  set(LEGACY_ROLE_KEY, null);
  const pending: PendingLogin = {
    conversationId,
    notice: notice ?? (conversationId ? "Đã liên kết cuộc trò chuyện từ Nova." : null),
    fallback,
  };
  set(PENDING_KEY, JSON.stringify(pending));
}

/** Sau khi đăng xuất: bỏ cuộc trò chuyện đang chờ của tab. */
export function clearTabLogin() {
  set(LEGACY_ROLE_KEY, null);
  set(PENDING_KEY, null);
}

/** Đọc và xóa kết quả đăng nhập đang chờ áp dụng (chỉ một lần). */
export function consumePendingLogin(): PendingLogin | null {
  const raw = get(PENDING_KEY);
  set(PENDING_KEY, null);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingLogin;
    return {
      conversationId: typeof p.conversationId === "string" ? p.conversationId : null,
      notice: typeof p.notice === "string" ? p.notice : null,
      fallback: p.fallback === true,
    };
  } catch {
    return null;
  }
}
