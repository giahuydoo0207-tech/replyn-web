import { initialState } from "../seed";
import type { Role } from "../types";

/**
 * MOCK — đăng nhập Replyn bằng danh tính Nova. Chưa gọi Nova API, Supabase Auth hay backend nào.
 * Cặp Nova ID / Nova Key dưới đây chỉ dành cho bản demo, không phải secret production.
 *
 * Khi có backend: server phải xác minh signed handoff (chữ ký, hạn dùng, người nhận) trước khi mở
 * cuộc trò chuyện. Query `handoff`, `conversation`, `returnTo` ở đây chỉ là dữ liệu mô phỏng phía client.
 */

export interface NovaDemoAccount {
  novaId: string;
  userId: string;
  role: Role;
}

/** Nova ID là định danh công khai; Nova Key là mã bí mật/dùng một lần đi kèm. */
export const DEMO_NOVA_ID_LOGIN = {
  novaId: "NVB-7K29Q",
  novaKey: "DEMO-2026",
  account: { novaId: "NVB-7K29Q", userId: "u-ha", role: "business" } satisfies NovaDemoAccount,
};

/** Thiết bị Nova Mobile "quét" mã QR trong demo. */
export const DEMO_QR_ACCOUNT: NovaDemoAccount = { novaId: "NVF-3MK81", userId: "u-khoa", role: "freelancer" };

export const QR_TTL_SECONDS = 60;
export const NOVA_ID_PATTERN = /^NV[BF]-[A-Z0-9]{5}$/;

/** "  nvb 7k29q " → "NVB-7K29Q" */
export function normalizeNovaId(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  return /^NV[BF][A-Z0-9]{5}$/.test(compact) ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type NovaIdResult = { ok: true; account: NovaDemoAccount } | { ok: false; reason: "invalid" };

/** Mô phỏng xác thực Nova ID + Nova Key. */
export async function verifyNovaId(novaId: string, novaKey: string): Promise<NovaIdResult> {
  await wait(700 + Math.random() * 400);
  const ok = novaId === DEMO_NOVA_ID_LOGIN.novaId && novaKey.trim() === DEMO_NOVA_ID_LOGIN.novaKey;
  return ok ? { ok: true, account: DEMO_NOVA_ID_LOGIN.account } : { ok: false, reason: "invalid" };
}

/** Mô phỏng tạo phiên QR. Nội dung QR là URL demo, không chứa access token. */
export async function createQrSession(origin: string, fail = false): Promise<{ id: string; url: string; expiresAt: number }> {
  await wait(500 + Math.random() * 300);
  if (fail) throw new Error("qr-unavailable");
  const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  return { id, url: `${origin}/auth/nova?demo-qr=${id}`, expiresAt: Date.now() + QR_TTL_SECONDS * 1000 };
}

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
