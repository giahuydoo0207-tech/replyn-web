import type { Role } from "../types";

/**
 * MOCK — phiên đăng nhập Nova của từng tab, chỉ dùng sessionStorage (không chia sẻ giữa các tab).
 * Chỉ lưu: vai trò của tab, cuộc trò chuyện cần mở sau đăng nhập và một thông báo hiển thị một lần.
 * Không lưu dữ liệu ứng dụng; dữ liệu chat vẫn là reducer mock trong bộ nhớ.
 */
const ROLE_KEY = "replyn.auth.role";
const PENDING_KEY = "replyn.auth.pending";

export interface PendingLogin {
  /** null: mở danh sách chat */
  conversationId: string | null;
  notice: string | null;
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

/** Gọi khi đăng nhập Nova (mock) thành công, ngay trước khi chuyển sang màn chat. */
export function startTabFromNovaLogin(role: Role, conversationId: string | null) {
  set(ROLE_KEY, role);
  queuePending(conversationId);
}

/**
 * Đăng nhập Nova ID (thật): vai Business đến từ cookie phiên do server ký, nên tab chỉ giữ cuộc trò chuyện
 * cần mở và bỏ vai trò mock cũ (nếu có).
 */
export function queuePendingLogin(conversationId: string | null) {
  set(ROLE_KEY, null);
  queuePending(conversationId);
}

/** Sau khi đăng xuất: bỏ vai trò và cuộc trò chuyện đang chờ của tab. */
export function clearTabLogin() {
  set(ROLE_KEY, null);
  set(PENDING_KEY, null);
}

function queuePending(conversationId: string | null) {
  const pending: PendingLogin = {
    conversationId,
    notice: conversationId ? "Đã liên kết cuộc trò chuyện từ Nova." : null,
  };
  set(PENDING_KEY, JSON.stringify(pending));
}

/**
 * Vai trò mock của tab (giữ qua refresh trong cùng tab). Chỉ dùng cho luồng QR thử nghiệm; vai Business
 * không bao giờ được cấp từ sessionStorage.
 */
export function readTabRole(): Role | null {
  const r = get(ROLE_KEY);
  return r === "freelancer" ? r : null;
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
    };
  } catch {
    return null;
  }
}
