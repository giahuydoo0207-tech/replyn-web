import type { AuthResponseBody, PublicIdentity } from "./server/novaBusinessAuth";

/**
 * Phía trình duyệt của đăng nhập Nova Business. Chỉ gọi route của chính Replyn; server mới là nơi gọi Nova
 * và quyết định đã xác thực hay chưa. Không lưu Nova Key ở đâu cả.
 */

/** Trùng với định dạng server kiểm tra (`server/novaBusinessAuth.ts`). */
export const NOVA_BUSINESS_ID_PATTERN = /^NVB-[2-9A-HJKMNP-Z]{8}$/;
export const NOVA_KEY_PATTERN = /^nvk_[A-Za-z0-9_-]{43}$/;

export type BusinessIdentity = PublicIdentity;

export type BusinessLoginResult =
  | { ok: true; identity: BusinessIdentity }
  | { ok: false; reason: "invalid_credentials" | "unavailable" | "not_configured" | "invalid_input" };

/** "  nvb k7m2 q9xh " → "NVB-K7M2Q9XH"; giá trị khác chỉ bỏ khoảng trắng và viết hoa. */
export function normalizeBusinessNovaId(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  return /^NVB[2-9A-HJKMNP-Z]{8}$/.test(compact) ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
}

async function readBody(response: Response): Promise<AuthResponseBody | null> {
  try {
    return (await response.json()) as AuthResponseBody;
  } catch {
    return null;
  }
}

export async function loginWithNovaBusiness(novaId: string, novaKey: string, remember: boolean): Promise<BusinessLoginResult> {
  let response: Response;
  try {
    response = await fetch("/api/auth/nova/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novaId, novaKey, remember }),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const body = await readBody(response);
  if (response.ok && body && "authenticated" in body && body.authenticated) return { ok: true, identity: body.identity };
  if (response.status === 401) return { ok: false, reason: "invalid_credentials" };
  if (response.status === 400) return { ok: false, reason: "invalid_input" };
  if (body && "error" in body && body.error === "not_configured") return { ok: false, reason: "not_configured" };
  return { ok: false, reason: "unavailable" };
}

/** Danh tính Business từ cookie phiên (đọc qua server), null nếu chưa đăng nhập hoặc không kiểm tra được. */
export async function fetchBusinessSession(): Promise<BusinessIdentity | null> {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
    const body = await readBody(response);
    return response.ok && body && "authenticated" in body && body.authenticated ? body.identity : null;
  } catch {
    return null;
  }
}

/** Chỉ trả true khi server đã xóa cookie phiên; cookie HttpOnly không thể xóa từ JavaScript. */
export async function logoutBusiness(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    return response.ok;
  } catch {
    return false;
  }
}
