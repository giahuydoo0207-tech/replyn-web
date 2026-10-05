import { initialState } from "../seed";

/**
 * MOCK — metadata handoff từ Nova Chat. Đăng nhập (Nova ID, mã QR) đã chạy thật qua server Replyn; phần này
 * chưa gọi Nova API hay Supabase nào.
 *
 * Khi có backend: server phải xác minh signed handoff (chữ ký, hạn dùng, người nhận) trước khi mở
 * cuộc trò chuyện. Query `handoff`, `conversation` ở đây chỉ là dữ liệu mô phỏng phía client.
 */
/* ---------- Handoff từ Nova ---------- */

export interface HandoffInfo {
  handoff: string;
  conversationId: string;
  title: string;
  project?: string;
  members: { id: string; name: string; initials: string; color: string }[];
}

let seedCache: ReturnType<typeof initialState> | null = null;
const seed = () => (seedCache ??= initialState());

/** Chỉ đọc metadata công khai của cuộc trò chuyện (tên, thành viên, dự án), không đọc tin nhắn. */
export function resolveHandoff(handoff: string | null, conversation: string | null): HandoffInfo | null {
  if (!handoff || !conversation) return null;
  const s = seed();
  const c = s.conversations[conversation];
  if (!c || (c.kind !== "nova" && c.kind !== "replyn")) return null;
  const members = c.memberIds
    .map((id) => s.users[id])
    .filter(Boolean)
    .map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      initials: u.name.split(/\s+/).slice(-2).map((w) => w[0]!.toUpperCase()).join(""),
    }));
  return { handoff, conversationId: c.id, title: c.title, project: c.proposal?.projectTitle, members };
}

/** Chỉ cho phép đường dẫn nội bộ, chặn open redirect (`//evil.com`, `https://…`). */
export function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}
