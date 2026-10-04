import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Đăng nhập Nova Business thật: xác minh Nova ID + Nova Key với Nova backend (Railway) rồi cấp phiên Replyn
 * ký HMAC trong cookie HttpOnly. Chỉ chạy phía server.
 *
 * File này cố ý không import module nội bộ nào (chỉ `node:crypto`) để test chạy thẳng bằng `node --test`.
 * Nova Key không bao giờ nằm trong phiên, cookie, log hay thông báo lỗi.
 */

/** Định dạng Nova ID / Nova Key do Nova Business cấp (giữ trùng với `src/lib/auth/novaBusinessClient.ts`). */
export const NOVA_BUSINESS_ID_PATTERN = /^NVB-[2-9A-HJKMNP-Z]{8}$/;
export const NOVA_KEY_PATTERN = /^nvk_[A-Za-z0-9_-]{43}$/;

export const SESSION_COOKIE = "replyn_session";
export const SESSION_VERSION = 1;
/** Phiên thường kết thúc khi đóng trình duyệt hoặc sau 8 giờ; "Ghi nhớ thiết bị" giữ 7 ngày. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const REMEMBERED_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_BODY_BYTES = 2048;
export const NOVA_TIMEOUT_MS = 8000;
const MIN_SECRET_BYTES = 32;
const MAX_DISPLAY_NAME = 160;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface AuthEnv {
  NOVA_API_URL?: string;
  REPLYN_SESSION_SECRET?: string;
  NODE_ENV?: string;
}

export interface AuthDeps {
  env: AuthEnv;
  fetch: typeof fetch;
  /** mili giây */
  now: () => number;
  timeoutMs?: number;
}

export interface ReplynSession {
  v: typeof SESSION_VERSION;
  provider: "NOVA";
  subjectType: "ORGANIZATION";
  subjectId: string;
  publicNovaId: string;
  displayName: string;
  role: "business";
  /** giây Unix */
  iat: number;
  exp: number;
}

/** Danh tính trả về trình duyệt: không có subjectId nội bộ, không có gì bí mật. */
export interface PublicIdentity {
  provider: "NOVA";
  subjectType: "ORGANIZATION";
  publicNovaId: string;
  displayName: string;
  role: "business";
}

export type AuthErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "unavailable"
  | "not_configured"
  | "unsupported_media_type"
  | "payload_too_large"
  | "forbidden";

export type AuthResponseBody =
  | { authenticated: true; identity: PublicIdentity; expiresAt: string }
  | { authenticated: false }
  | { error: AuthErrorCode };

export function liveAuthDeps(): AuthDeps {
  return { env: process.env, fetch: globalThis.fetch, now: Date.now };
}

/* ---------- cấu hình ---------- */

interface AuthConfig {
  verifyUrl: string;
  secret: string;
  secure: boolean;
}

function readSecret(env: AuthEnv): string | null {
  const secret = env.REPLYN_SESSION_SECRET;
  return secret && Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES ? secret : null;
}

/** Null khi thiếu hoặc sai cấu hình; không có giá trị mặc định và không quay về mock. */
function readConfig(env: AuthEnv): AuthConfig | null {
  const secret = readSecret(env);
  if (!secret || !env.NOVA_API_URL) return null;
  let base: URL;
  try {
    base = new URL(env.NOVA_API_URL);
  } catch {
    return null;
  }
  // HTTPS bắt buộc; http chỉ cho máy chủ giả lập chạy trên chính máy (loopback) khi kiểm thử.
  const secureTransport = base.protocol === "https:" || (base.protocol === "http:" && LOOPBACK_HOSTS.has(base.hostname));
  if (!secureTransport || base.username || base.password || base.search || base.hash) return null;
  return {
    verifyUrl: new URL("/api/v1/nova-credentials/verify", base.origin).toString(),
    secret,
    secure: env.NODE_ENV === "production",
  };
}

/* ---------- phiên ký HMAC ---------- */

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

export function signSession(session: ReplynSession, secret: string): string {
  const payload = b64(JSON.stringify(session));
  return `${payload}.${b64(mac(payload, secret))}`;
}

/** Null nếu chữ ký sai, payload bị sửa, sai phiên bản hoặc đã hết hạn. */
export function verifySession(token: string | null | undefined, secret: string, nowSeconds: number): ReplynSession | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = mac(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let s: Partial<ReplynSession>;
  try {
    s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const valid =
    s.v === SESSION_VERSION &&
    s.provider === "NOVA" &&
    s.subjectType === "ORGANIZATION" &&
    s.role === "business" &&
    typeof s.subjectId === "string" &&
    UUID.test(s.subjectId) &&
    typeof s.publicNovaId === "string" &&
    NOVA_BUSINESS_ID_PATTERN.test(s.publicNovaId) &&
    typeof s.displayName === "string" &&
    s.displayName.length > 0 &&
    Number.isInteger(s.iat) &&
    Number.isInteger(s.exp) &&
    (s.iat as number) <= nowSeconds + 60 &&
    (s.exp as number) > nowSeconds &&
    (s.exp as number) - (s.iat as number) <= REMEMBERED_SESSION_TTL_SECONDS;
  return valid ? (s as ReplynSession) : null;
}

export function sessionCookie(token: string, { secure, maxAge }: { secure: boolean; maxAge?: number }): string {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie({ secure }: { secure: boolean }): string {
  return sessionCookie("", { secure, maxAge: 0 }) + "; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function publicIdentity(s: ReplynSession): PublicIdentity {
  return { provider: s.provider, subjectType: s.subjectType, publicNovaId: s.publicNovaId, displayName: s.displayName, role: s.role };
}

/* ---------- gọi Nova backend ---------- */

export type NovaVerifyResult =
  | { ok: true; subjectId: string; publicNovaId: string; displayName: string }
  | { ok: false; reason: "invalid_credentials" | "unavailable" };

function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // bỏ ký tự điều khiển; tên hiển thị chỉ là văn bản thuần
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  return name.length > 0 && name.length <= MAX_DISPLAY_NAME ? name : null;
}

export async function verifyWithNova(
  verifyUrl: string,
  novaId: string,
  novaKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<NovaVerifyResult> {
  let response: Response;
  try {
    response = await fetchImpl(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ novaId, novaKey }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // mạng lỗi hoặc quá thời gian chờ; không đưa chi tiết (có thể chứa URL/headers) ra ngoài
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401) return { ok: false, reason: "invalid_credentials" };
  if (response.status !== 200) return { ok: false, reason: "unavailable" };
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object") return { ok: false, reason: "unavailable" };
    body = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const displayName = cleanDisplayName(body.displayName);
  const valid =
    body.verified === true &&
    body.subjectType === "ORGANIZATION" &&
    typeof body.subjectId === "string" &&
    UUID.test(body.subjectId) &&
    body.publicNovaId === novaId &&
    displayName !== null;
  if (!valid) return { ok: false, reason: "unavailable" };
  return { ok: true, subjectId: (body.subjectId as string).toLowerCase(), publicNovaId: novaId, displayName };
}

/* ---------- route handlers ---------- */

function json(status: number, body: AuthResponseBody, setCookie?: string): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

/** Chặn POST từ trang khác (trình duyệt luôn gửi Origin cho fetch POST). */
function crossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** POST /api/auth/nova/business */
export async function handleBusinessLogin(request: Request, deps: AuthDeps): Promise<Response> {
  if (crossOrigin(request)) return json(403, { error: "forbidden" });
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) return json(415, { error: "unsupported_media_type" });
  const config = readConfig(deps.env);
  if (!config) return json(503, { error: "not_configured" });

  const raw = await readLimitedBody(request);
  if (raw === null) return json(413, { error: "payload_too_large" });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_input" });
  }
  if (!input || typeof input !== "object") return json(400, { error: "invalid_input" });
  const { novaId, novaKey, remember } = input as Record<string, unknown>;
  if (typeof novaId !== "string" || typeof novaKey !== "string" || (remember !== undefined && typeof remember !== "boolean")) {
    return json(400, { error: "invalid_input" });
  }
  const id = novaId.trim().toUpperCase();
  // Nova Key được kiểm tra nguyên văn, không trim hay đổi chữ hoa/thường
  if (!NOVA_BUSINESS_ID_PATTERN.test(id) || !NOVA_KEY_PATTERN.test(novaKey)) return json(400, { error: "invalid_input" });

  const result = await verifyWithNova(config.verifyUrl, id, novaKey, deps.fetch, deps.timeoutMs ?? NOVA_TIMEOUT_MS);
  if (!result.ok) {
    return result.reason === "invalid_credentials"
      ? json(401, { error: "invalid_credentials" })
      : json(503, { error: "unavailable" });
  }

  const iat = Math.floor(deps.now() / 1000);
  const ttl = remember === true ? REMEMBERED_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  const session: ReplynSession = {
    v: SESSION_VERSION,
    provider: "NOVA",
    subjectType: "ORGANIZATION",
    subjectId: result.subjectId,
    publicNovaId: result.publicNovaId,
    displayName: result.displayName,
    role: "business",
    iat,
    exp: iat + ttl,
  };
  const cookie = sessionCookie(signSession(session, config.secret), {
    secure: config.secure,
    maxAge: remember === true ? ttl : undefined,
  });
  return json(
    200,
    { authenticated: true, identity: publicIdentity(session), expiresAt: new Date(session.exp * 1000).toISOString() },
    cookie,
  );
}

/** GET /api/auth/session */
export function handleSession(request: Request, deps: AuthDeps): Response {
  const secret = readSecret(deps.env);
  if (!secret) return json(503, { error: "not_configured" });
  const secure = deps.env.NODE_ENV === "production";
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return json(200, { authenticated: false });
  const session = verifySession(token, secret, Math.floor(deps.now() / 1000));
  if (!session) return json(200, { authenticated: false }, clearSessionCookie({ secure }));
  return json(200, {
    authenticated: true,
    identity: publicIdentity(session),
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}

/** POST /api/auth/logout */
export function handleLogout(request: Request, deps: AuthDeps): Response {
  if (crossOrigin(request)) return json(403, { error: "forbidden" });
  return json(200, { authenticated: false }, clearSessionCookie({ secure: deps.env.NODE_ENV === "production" }));
}
