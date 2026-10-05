import { readAuthBody, type TalentIdentity } from "./novaBusinessClient";

/**
 * Phía trình duyệt của đăng nhập bằng mã QR. Chỉ gọi route same-origin của Replyn. pairingId và
 * browserSecret nằm trong cookie HttpOnly nên JavaScript không đọc được; trình duyệt chỉ nhận URL để vẽ mã.
 */

export const QR_POLL_INTERVAL_MS = 2000;
/** Số lần hỏi lỗi tạm thời liên tiếp trước khi dừng và báo lỗi. */
export const QR_MAX_POLL_FAILURES = 3;

export type QrStartResult =
  | { ok: true; qrUrl: string; expiresAt: number }
  | { ok: false; reason: "not_configured" | "unavailable" };

export type QrPollResult =
  | { kind: "pending" }
  | { kind: "approved"; identity: TalentIdentity }
  | { kind: "expired" }
  | { kind: "used" }
  | { kind: "error"; retryable: boolean };

export async function startNovaQr(): Promise<QrStartResult> {
  let response: Response;
  try {
    response = await fetch("/api/auth/nova/qr", { method: "POST", cache: "no-store", credentials: "same-origin" });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const body = await readAuthBody(response);
  if (response.ok && body && "qrUrl" in body) {
    const expiresAt = Date.parse(body.expiresAt);
    if (Number.isFinite(expiresAt)) return { ok: true, qrUrl: body.qrUrl, expiresAt };
  }
  if (body && "error" in body && body.error === "not_configured") return { ok: false, reason: "not_configured" };
  return { ok: false, reason: "unavailable" };
}

/** `remember` chỉ quyết định cookie phiên còn lại sau khi đóng trình duyệt hay không. */
export async function pollNovaQr(remember: boolean): Promise<QrPollResult> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/nova/qr${remember ? "?remember=1" : ""}`, { cache: "no-store", credentials: "same-origin" });
  } catch {
    return { kind: "error", retryable: true };
  }
  if (response.status === 202) return { kind: "pending" };
  if (response.status === 410) return { kind: "expired" };
  if (response.status === 409) return { kind: "used" };
  const body = await readAuthBody(response);
  if (response.ok && body && "authenticated" in body && body.authenticated && body.identity.role === "freelancer") {
    return { kind: "approved", identity: body.identity };
  }
  const notConfigured = body !== null && "error" in body && body.error === "not_configured";
  return { kind: "error", retryable: response.status >= 500 && !notConfigured };
}
