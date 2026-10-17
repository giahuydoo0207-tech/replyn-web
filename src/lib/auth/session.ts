import { createHmac, timingSafeEqual } from "node:crypto";
import { accountById, type DemoAccount } from "./accounts";

/**
 * Phiên đăng nhập: cookie httpOnly chứa id tài khoản và hạn dùng, ký HMAC-SHA256 bằng REPLYN_SESSION_SECRET.
 * Chỉ chạy trên server. Trên production mà thiếu secret thì không cho đăng nhập, không dùng khóa mặc định.
 */
export const SESSION_COOKIE = "replyn_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 32;
const DEV_SECRET = "replyn-dev-only-secret-do-not-use-in-production";

export function readSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.REPLYN_SESSION_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  return env.NODE_ENV === "production" ? null : DEV_SECRET;
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(`replyn-session-v1.${data}`).digest();

export function signSession(accountId: string, secret: string, nowSeconds: number): string {
  const payload = b64(JSON.stringify({ uid: accountId, exp: nowSeconds + SESSION_TTL_SECONDS }));
  return `${payload}.${b64(mac(payload, secret))}`;
}

export function verifySession(token: string | null | undefined, secret: string, nowSeconds: number): DemoAccount | null {
  if (!token || token.length > 512) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = mac(payload, secret);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: unknown; exp?: unknown };
    if (typeof data.exp !== "number" || data.exp <= nowSeconds) return null;
    return accountById(data.uid);
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Tài khoản của request (route handler), hoặc null nếu chưa đăng nhập hay cookie sai. */
export function accountFromRequest(request: Request): DemoAccount | null {
  const secret = readSecret();
  if (!secret) return null;
  return verifySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE), secret, Math.floor(Date.now() / 1000));
}

export const isSecure = (request: Request) => new URL(request.url).protocol === "https:";
