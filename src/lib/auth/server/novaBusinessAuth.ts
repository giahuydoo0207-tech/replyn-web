import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Đăng nhập Replyn bằng Nova, chỉ chạy phía server, cấp phiên Replyn ký HMAC trong cookie HttpOnly:
 * - Nova Business: xác minh Nova ID + Nova Key với Nova backend (Railway).
 * - Talent qua mã QR: server Replyn tạo challenge trên Nova backend, Nova Mobile xác nhận, rồi server
 *   Replyn tiêu thụ challenge đúng một lần để lấy danh tính Talent.
 *
 * File này cố ý không import module nội bộ nào (chỉ `node:crypto`) để test chạy thẳng bằng `node --test`.
 * Nova Key, REPLYN_QR_CLIENT_SECRET và browserSecret không bao giờ được trả cho JavaScript, ghi log hay
 * đưa vào thông báo lỗi.
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
/** Mã Talent nội bộ của Nova (contractor_id). Không phải Nova ID và không bao giờ gửi cho trình duyệt. */
const TALENT_SUBJECT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/* Đăng nhập bằng mã QR */
export const QR_COOKIE = "replyn_qr_pairing";
export const QR_COOKIE_PATH = "/api/auth/nova/qr";
export const QR_TTL_SECONDS = 60;
/** 32 byte ngẫu nhiên, base64url không padding. */
export const QR_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const REPLYN_CLIENT_SECRET_HEADER = "X-Replyn-Client-Secret";
/** Tách miền chữ ký: token cookie QR không bao giờ hợp lệ như một phiên và ngược lại. */
const QR_MAC_CONTEXT = "replyn-qr-pairing-v1.";
/** Chênh lệch đồng hồ chấp nhận giữa Replyn và Nova khi kiểm tra expiresAt. */
const QR_CLOCK_SKEW_SECONDS = 30;

export interface AuthEnv {
  NOVA_API_URL?: string;
  REPLYN_SESSION_SECRET?: string;
  /** Secret server-to-server dùng chung với Nova backend, chỉ cho đăng nhập QR. */
  REPLYN_QR_CLIENT_SECRET?: string;
  /** Origin web Nova Business (không đường dẫn), để doanh nghiệp quay lại đúng cuộc trò chuyện trên Nova. Không bắt buộc. */
  NOVA_BUSINESS_WEB_URL?: string;
  NODE_ENV?: string;
}

export interface AuthDeps {
  env: AuthEnv;
  fetch: typeof fetch;
  /** mili giây */
  now: () => number;
  timeoutMs?: number;
}

interface SessionBase {
  v: typeof SESSION_VERSION;
  provider: "NOVA";
  /** giây Unix */
  iat: number;
  exp: number;
}

/** Doanh nghiệp đăng nhập bằng Nova ID + Nova Key. */
export interface BusinessSession extends SessionBase {
  subjectType: "ORGANIZATION";
  subjectId: string;
  publicNovaId: string;
  displayName: string;
  role: "business";
}

/** Talent đăng nhập bằng mã QR đã xác nhận trên Nova Mobile. Talent không có Nova ID công khai. */
export interface TalentSession extends SessionBase {
  subjectType: "TALENT";
  subjectId: string;
  displayName: string;
  role: "freelancer";
}

export type ReplynSession = BusinessSession | TalentSession;

/** Danh tính trả về trình duyệt: không có subjectId nội bộ, không có gì bí mật. */
export type PublicIdentity =
  | { provider: "NOVA"; subjectType: "ORGANIZATION"; publicNovaId: string; displayName: string; role: "business" }
  | { provider: "NOVA"; subjectType: "TALENT"; displayName: string; role: "freelancer"; verifiedBy: "NOVA_MOBILE" };

export type AuthErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "unavailable"
  | "not_configured"
  | "unsupported_media_type"
  | "payload_too_large"
  | "forbidden"
  | "unauthenticated"
  | "not_found";

/** Trạng thái mã QR khi trình duyệt hỏi lại (ngoài lúc đã đăng nhập). */
export type QrPollStatus = "pending" | "expired" | "used";

export type AuthResponseBody =
  | { authenticated: true; identity: PublicIdentity; expiresAt: string }
  | { authenticated: false }
  | { qrUrl: string; expiresAt: string }
  | { status: QrPollStatus }
  | { workspaces: PublicWorkspace[] }
  | { error: AuthErrorCode };

export function liveAuthDeps(): AuthDeps {
  return { env: process.env, fetch: globalThis.fetch, now: Date.now };
}

/* ---------- cấu hình ---------- */

interface AuthConfig {
  /** origin của Nova backend */
  novaOrigin: string;
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
  return { novaOrigin: base.origin, secret, secure: env.NODE_ENV === "production" };
}

/**
 * Origin của web Nova Business (`NOVA_BUSINESS_WEB_URL`) dùng cho liên kết "Mở cuộc trò chuyện trên Nova Business".
 * Không bắt buộc: thiếu hoặc sai thì null và giao diện ẩn liên kết. Chỉ nhận origin HTTPS không có đường dẫn;
 * http chỉ cho loopback khi không chạy production.
 */
export function readNovaBusinessWebOrigin(env: AuthEnv): string | null {
  const raw = env.NOVA_BUSINESS_WEB_URL?.trim();
  if (!raw) return null;
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    return null;
  }
  const loopback = base.protocol === "http:" && LOOPBACK_HOSTS.has(base.hostname) && env.NODE_ENV !== "production";
  if (base.protocol !== "https:" && !loopback) return null;
  if (base.username || base.password || base.search || base.hash || base.pathname !== "/") return null;
  return base.origin;
}

/** Cấu hình đăng nhập QR: như trên và thêm secret server-to-server với Nova. */
function readQrConfig(env: AuthEnv): (AuthConfig & { clientSecret: string }) | null {
  const config = readConfig(env);
  const clientSecret = env.REPLYN_QR_CLIENT_SECRET;
  if (!config || !clientSecret || Buffer.byteLength(clientSecret, "utf8") < MIN_SECRET_BYTES) return null;
  return { ...config, clientSecret };
}

/* ---------- phiên ký HMAC ---------- */

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

function signed(payload: string, secret: string): string {
  return `${payload}.${b64(mac(payload, secret))}`;
}

/** Payload JSON nếu chữ ký đúng, ngược lại null. */
function readSigned(token: string | null | undefined, secret: string, context = ""): Record<string, unknown> | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = mac(context + payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function signSession(session: ReplynSession, secret: string): string {
  return signed(b64(JSON.stringify(session)), secret);
}

/** Null nếu chữ ký sai, payload bị sửa, sai phiên bản, sai cặp loại tài khoản / vai trò hoặc đã hết hạn. */
export function verifySession(token: string | null | undefined, secret: string, nowSeconds: number): ReplynSession | null {
  const s = readSigned(token, secret);
  if (!s) return null;
  const common =
    s.v === SESSION_VERSION &&
    s.provider === "NOVA" &&
    typeof s.subjectId === "string" &&
    typeof s.displayName === "string" &&
    s.displayName.length > 0 &&
    Number.isInteger(s.iat) &&
    Number.isInteger(s.exp) &&
    (s.iat as number) <= nowSeconds + 60 &&
    (s.exp as number) > nowSeconds &&
    (s.exp as number) - (s.iat as number) <= REMEMBERED_SESSION_TTL_SECONDS;
  if (!common) return null;
  const business =
    s.subjectType === "ORGANIZATION" &&
    s.role === "business" &&
    UUID.test(s.subjectId as string) &&
    typeof s.publicNovaId === "string" &&
    NOVA_BUSINESS_ID_PATTERN.test(s.publicNovaId);
  const talent =
    s.subjectType === "TALENT" &&
    s.role === "freelancer" &&
    TALENT_SUBJECT.test(s.subjectId as string) &&
    s.publicNovaId === undefined;
  return business || talent ? (s as unknown as ReplynSession) : null;
}

function cookie(name: string, value: string, { secure, maxAge, path = "/" }: { secure: boolean; maxAge?: number; path?: string }): string {
  const parts = [`${name}=${value}`, `Path=${path}`, "HttpOnly", "SameSite=Lax"];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const EXPIRED = "; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

export function sessionCookie(token: string, options: { secure: boolean; maxAge?: number }): string {
  return cookie(SESSION_COOKIE, token, options);
}

export function clearSessionCookie({ secure }: { secure: boolean }): string {
  return sessionCookie("", { secure, maxAge: 0 }) + EXPIRED;
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
  return s.subjectType === "ORGANIZATION"
    ? { provider: s.provider, subjectType: s.subjectType, publicNovaId: s.publicNovaId, displayName: s.displayName, role: s.role }
    : { provider: s.provider, subjectType: s.subjectType, displayName: s.displayName, role: s.role, verifiedBy: "NOVA_MOBILE" };
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

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await response.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** POST JSON tới Nova; null khi mạng lỗi hoặc quá thời gian chờ (không đưa chi tiết có thể chứa URL/headers ra ngoài). */
async function postToNova(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response | null> {
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
}

export async function verifyWithNova(
  verifyUrl: string,
  novaId: string,
  novaKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<NovaVerifyResult> {
  const response = await postToNova(verifyUrl, { novaId, novaKey }, {}, fetchImpl, timeoutMs);
  if (!response) return { ok: false, reason: "unavailable" };
  if (response.status === 401) return { ok: false, reason: "invalid_credentials" };
  if (response.status !== 200) return { ok: false, reason: "unavailable" };
  const body = await readJsonObject(response);
  if (!body) return { ok: false, reason: "unavailable" };
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

export interface CreatedPairing {
  pairingId: string;
  qrSecret: string;
  browserSecret: string;
  /** mili giây Unix */
  expiresAt: number;
}

/** Tạo challenge QR trên Nova backend. Null khi Nova lỗi hoặc trả dữ liệu không hợp lệ. */
export async function createNovaPairing(
  novaOrigin: string,
  clientSecret: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  nowMs: number,
): Promise<CreatedPairing | null> {
  const response = await postToNova(
    `${novaOrigin}/api/v1/integrations/replyn/pairings`,
    { action: "login" },
    { [REPLYN_CLIENT_SECRET_HEADER]: clientSecret },
    fetchImpl,
    timeoutMs,
  );
  if (!response || response.status !== 201) return null;
  const body = await readJsonObject(response);
  if (!body) return null;
  const { pairingId, qrSecret, browserSecret } = body;
  const expiresAt = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
  const valid =
    typeof pairingId === "string" &&
    UUID.test(pairingId) &&
    typeof qrSecret === "string" &&
    QR_SECRET_PATTERN.test(qrSecret) &&
    typeof browserSecret === "string" &&
    QR_SECRET_PATTERN.test(browserSecret) &&
    qrSecret !== browserSecret &&
    Number.isFinite(expiresAt) &&
    expiresAt > nowMs &&
    expiresAt <= nowMs + (QR_TTL_SECONDS + QR_CLOCK_SKEW_SECONDS) * 1000;
  if (!valid) return null;
  return { pairingId: pairingId.toLowerCase(), qrSecret, browserSecret, expiresAt };
}

export type ConsumeResult =
  | { kind: "approved"; subjectId: string; displayName: string }
  | { kind: "pending" | "expired" | "used" | "unavailable" };

/** Hỏi Nova backend trạng thái challenge; khi đã duyệt thì Nova chuyển nó sang CONSUMED và trả danh tính một lần. */
export async function consumeNovaPairing(
  novaOrigin: string,
  clientSecret: string,
  pairingId: string,
  browserSecret: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ConsumeResult> {
  const response = await postToNova(
    `${novaOrigin}/api/v1/integrations/replyn/pairings/${encodeURIComponent(pairingId)}/consume`,
    { browserSecret },
    { [REPLYN_CLIENT_SECRET_HEADER]: clientSecret },
    fetchImpl,
    timeoutMs,
  );
  if (!response) return { kind: "unavailable" };
  if (response.status === 202) return { kind: "pending" };
  // 404: mã không còn trên Nova (đã dọn) hoặc secret không khớp; với trình duyệt đều là hết hạn
  if (response.status === 410 || response.status === 404) return { kind: "expired" };
  if (response.status === 409) return { kind: "used" };
  if (response.status !== 200) return { kind: "unavailable" };
  const body = await readJsonObject(response);
  const identity = body?.identity && typeof body.identity === "object" ? (body.identity as Record<string, unknown>) : null;
  const displayName = cleanDisplayName(identity?.displayName);
  const valid =
    body?.status === "CONSUMED" &&
    identity !== null &&
    identity.provider === "NOVA" &&
    identity.subjectType === "TALENT" &&
    identity.role === "freelancer" &&
    typeof identity.subjectId === "string" &&
    TALENT_SUBJECT.test(identity.subjectId) &&
    displayName !== null;
  if (!valid) return { kind: "unavailable" };
  return { kind: "approved", subjectId: identity.subjectId as string, displayName };
}

/* ---------- cookie challenge QR ---------- */

interface PairingCookie {
  v: 1;
  p: string;
  b: string;
  /** giây Unix, lấy từ expiresAt của Nova */
  exp: number;
}

export function signPairingCookie(value: PairingCookie, secret: string): string {
  const payload = b64(JSON.stringify(value));
  return `${payload}.${b64(mac(QR_MAC_CONTEXT + payload, secret))}`;
}

export function verifyPairingCookie(token: string | null | undefined, secret: string, nowSeconds: number): PairingCookie | null {
  const c = readSigned(token, secret, QR_MAC_CONTEXT);
  const valid =
    c !== null &&
    c.v === 1 &&
    typeof c.p === "string" &&
    UUID.test(c.p) &&
    typeof c.b === "string" &&
    QR_SECRET_PATTERN.test(c.b) &&
    Number.isInteger(c.exp) &&
    (c.exp as number) > nowSeconds &&
    (c.exp as number) <= nowSeconds + QR_TTL_SECONDS + QR_CLOCK_SKEW_SECONDS;
  return valid ? (c as unknown as PairingCookie) : null;
}

export function pairingCookie(token: string, { secure }: { secure: boolean }): string {
  return cookie(QR_COOKIE, token, { secure, maxAge: QR_TTL_SECONDS, path: QR_COOKIE_PATH });
}

export function clearPairingCookie({ secure }: { secure: boolean }): string {
  return cookie(QR_COOKIE, "", { secure, maxAge: 0, path: QR_COOKIE_PATH }) + EXPIRED;
}

/* ---------- route handlers ---------- */

function json(status: number, body: AuthResponseBody, ...setCookies: (string | undefined)[]): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  for (const value of setCookies) if (value) headers.append("Set-Cookie", value);
  return new Response(JSON.stringify(body), { status, headers });
}

/** Chặn POST từ trang khác (trình duyệt luôn gửi Origin cho fetch POST). */
function crossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

/**
 * Chặt hơn `crossOrigin` cho QR: POST phải có Origin đúng của Replyn; GET không được đến từ trang khác
 * (Sec-Fetch-Site) và nếu có Origin thì phải khớp.
 */
function sameOrigin(request: Request): boolean {
  const own = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (request.method !== "GET") return origin === own;
  const site = request.headers.get("sec-fetch-site");
  return (origin === null || origin === own) && (site === null || site === "same-origin");
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

function issueSession(
  identity: { subjectType: "ORGANIZATION"; subjectId: string; publicNovaId: string; displayName: string } | { subjectType: "TALENT"; subjectId: string; displayName: string },
  remember: boolean,
  config: AuthConfig,
  nowMs: number,
): { session: ReplynSession; cookie: string } {
  const iat = Math.floor(nowMs / 1000);
  const ttl = remember ? REMEMBERED_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  const times = { v: SESSION_VERSION, provider: "NOVA", iat, exp: iat + ttl } as const;
  const session: ReplynSession =
    identity.subjectType === "ORGANIZATION"
      ? { ...times, subjectType: "ORGANIZATION", subjectId: identity.subjectId, publicNovaId: identity.publicNovaId, displayName: identity.displayName, role: "business" }
      : { ...times, subjectType: "TALENT", subjectId: identity.subjectId, displayName: identity.displayName, role: "freelancer" };
  const cookieValue = sessionCookie(signSession(session, config.secret), {
    secure: config.secure,
    maxAge: remember ? ttl : undefined,
  });
  return { session, cookie: cookieValue };
}

function authenticated(session: ReplynSession, ...setCookies: string[]): Response {
  return json(
    200,
    { authenticated: true, identity: publicIdentity(session), expiresAt: new Date(session.exp * 1000).toISOString() },
    ...setCookies,
  );
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

  const verifyUrl = `${config.novaOrigin}/api/v1/nova-credentials/verify`;
  const result = await verifyWithNova(verifyUrl, id, novaKey, deps.fetch, deps.timeoutMs ?? NOVA_TIMEOUT_MS);
  if (!result.ok) {
    return result.reason === "invalid_credentials"
      ? json(401, { error: "invalid_credentials" })
      : json(503, { error: "unavailable" });
  }

  const { session, cookie: sessionValue } = issueSession(
    { subjectType: "ORGANIZATION", subjectId: result.subjectId, publicNovaId: result.publicNovaId, displayName: result.displayName },
    remember === true,
    config,
    deps.now(),
  );
  return authenticated(session, sessionValue);
}

/**
 * POST /api/auth/nova/qr — tạo mã QR. Trình duyệt nhận `qrUrl` (có qrSecret để hiện mã) và hạn dùng;
 * pairingId + browserSecret chỉ nằm trong cookie HttpOnly đã ký.
 */
export async function handleQrCreate(request: Request, deps: AuthDeps): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = readQrConfig(deps.env);
  if (!config) return json(503, { error: "not_configured" });
  const nowMs = deps.now();
  const created = await createNovaPairing(config.novaOrigin, config.clientSecret, deps.fetch, deps.timeoutMs ?? NOVA_TIMEOUT_MS, nowMs);
  if (!created) return json(503, { error: "unavailable" });

  const exp = Math.floor(created.expiresAt / 1000);
  const token = signPairingCookie({ v: 1, p: created.pairingId, b: created.browserSecret, exp }, config.secret);
  const qrUrl = new URL("/auth/nova", new URL(request.url).origin);
  qrUrl.search = new URLSearchParams({ pairing: created.pairingId, secret: created.qrSecret, exp: String(exp), action: "login" }).toString();
  return json(
    200,
    { qrUrl: qrUrl.toString(), expiresAt: new Date(created.expiresAt).toISOString() },
    pairingCookie(token, { secure: config.secure }),
  );
}

/**
 * GET /api/auth/nova/qr[?remember=1] — trình duyệt hỏi lại mỗi 2 giây. Khi Nova Mobile đã xác nhận, server
 * tiêu thụ challenge, đặt cookie phiên Replyn và xóa cookie challenge.
 */
export async function handleQrPoll(request: Request, deps: AuthDeps): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = readQrConfig(deps.env);
  if (!config) return json(503, { error: "not_configured" });
  const clear = clearPairingCookie({ secure: config.secure });
  const nowMs = deps.now();
  const pairing = verifyPairingCookie(readCookie(request.headers.get("cookie"), QR_COOKIE), config.secret, Math.floor(nowMs / 1000));
  if (!pairing) return json(410, { status: "expired" }, clear);

  const result = await consumeNovaPairing(config.novaOrigin, config.clientSecret, pairing.p, pairing.b, deps.fetch, deps.timeoutMs ?? NOVA_TIMEOUT_MS);
  switch (result.kind) {
    case "pending":
      return json(202, { status: "pending" });
    case "expired":
      return json(410, { status: "expired" }, clear);
    case "used":
      return json(409, { status: "used" }, clear);
    case "unavailable":
      // lỗi tạm thời: giữ cookie để lần hỏi sau thử lại
      return json(503, { error: "unavailable" });
    case "approved": {
      const remember = new URL(request.url).searchParams.get("remember") === "1";
      const { session, cookie: sessionValue } = issueSession(
        { subjectType: "TALENT", subjectId: result.subjectId, displayName: result.displayName },
        remember,
        config,
        nowMs,
      );
      return authenticated(session, sessionValue, clear);
    }
  }
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

/* ---------- workspace từ đề xuất Nova đã được chấp nhận ---------- */

/**
 * Workspace trả cho trình duyệt: thỏa thuận đã chấp nhận và tên hiển thị hai bên. Không có mã hồ sơ nội bộ,
 * không có id đề xuất; `workspaceId` là id mờ do Nova cấp khi freelancer chấp nhận.
 */
export interface PublicWorkspace {
  workspaceId: string;
  projectName: string;
  scope: string;
  deliverables: string[];
  revisionLimit: number | null;
  currency: string;
  totalAmount: number;
  startDate: string | null;
  deadline: string | null;
  reviewPeriodDays: number | null;
  milestones: { title: string; amount: number; deadline: string | null }[];
  notes: string;
  acceptedAt: string;
  businessName: string;
  freelancerName: string;
  viewerRole: "business" | "freelancer";
  /**
   * Chỉ cho doanh nghiệp: liên kết tới đúng cuộc trò chuyện Nova Business đã gửi đề xuất. Không có khi thiếu cấu
   * hình hoặc Nova chưa gửi `sourceThreadId`. Freelancer không bao giờ nhận id cuộc trò chuyện Nova.
   */
  novaReturnUrl?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WORKSPACES = 50;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text.length <= max ? text : null;
}

/** null là hợp lệ (trường không bắt buộc); undefined nghĩa là dữ liệu sai. */
function optionalDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

function optionalInt(value: unknown, min: number, max: number): number | null | undefined {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined;
}

function positiveAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000_000 ? value : null;
}

/** Kiểm tra chặt dữ liệu Nova trả về; một trường sai là bỏ cả workspace thay vì hiển thị nửa vời. */
export function parseNovaWorkspace(
  raw: unknown,
  viewerRole: "business" | "freelancer",
  novaBusinessWebOrigin: string | null = null,
): PublicWorkspace | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  const projectName = cleanText(w.projectName, 160);
  const scope = cleanText(w.scope, 4000);
  const notes = w.notes === null || w.notes === undefined ? "" : cleanText(w.notes, 2000);
  const businessName = cleanDisplayName(w.businessName);
  const freelancerName = cleanDisplayName(w.freelancerName);
  const totalAmount = positiveAmount(w.totalAmount);
  const startDate = optionalDate(w.startDate);
  const deadline = optionalDate(w.deadline);
  const revisionLimit = optionalInt(w.revisionLimit, 0, 20);
  const reviewPeriodDays = optionalInt(w.reviewPeriodDays, 1, 30);
  const acceptedAt = typeof w.acceptedAt === "string" && Number.isFinite(Date.parse(w.acceptedAt)) ? w.acceptedAt : null;
  if (
    typeof w.workspaceId !== "string" || !UUID.test(w.workspaceId) || !projectName || scope === null || notes === null ||
    !businessName || !freelancerName || totalAmount === null || startDate === undefined || deadline === undefined ||
    revisionLimit === undefined || reviewPeriodDays === undefined || !acceptedAt || w.currency !== "USDC" ||
    w.viewerRole !== viewerRole || !Array.isArray(w.deliverables) || !Array.isArray(w.milestones) ||
    w.deliverables.length > 20 || w.milestones.length === 0 || w.milestones.length > 10
  ) {
    return null;
  }
  const deliverables: string[] = [];
  for (const item of w.deliverables) {
    const text = cleanText(item, 300);
    if (!text) return null;
    deliverables.push(text);
  }
  const milestones: PublicWorkspace["milestones"] = [];
  for (const item of w.milestones) {
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    const title = cleanText(m.title, 160);
    const amount = positiveAmount(m.amount);
    const due = optionalDate(m.deadline);
    if (!title || amount === null || due === undefined) return null;
    milestones.push({ title, amount, deadline: due });
  }
  // `sourceThreadId` không bắt buộc (backend Nova cũ chưa gửi); sai định dạng thì bỏ qua, không loại workspace.
  const sourceThreadId = typeof w.sourceThreadId === "string" && UUID.test(w.sourceThreadId) ? w.sourceThreadId.toLowerCase() : null;
  const novaReturnUrl = viewerRole === "business" && novaBusinessWebOrigin && sourceThreadId
    ? `${novaBusinessWebOrigin}/business/messages?thread=${encodeURIComponent(sourceThreadId)}`
    : null;
  return {
    workspaceId: w.workspaceId.toLowerCase(), projectName, scope, deliverables, revisionLimit, currency: "USDC", totalAmount,
    startDate, deadline, reviewPeriodDays, milestones, notes, acceptedAt, businessName, freelancerName, viewerRole,
    ...(novaReturnUrl ? { novaReturnUrl } : {}),
  };
}

export type WorkspaceLookup = { kind: "ok"; workspaces: PublicWorkspace[] } | { kind: "not_found" } | { kind: "unavailable" };

/** Hỏi Nova các workspace mà danh tính trong phiên được phép mở. Danh tính lấy từ phiên đã ký, không từ trình duyệt. */
export async function lookupNovaWorkspaces(
  novaOrigin: string,
  clientSecret: string,
  session: ReplynSession,
  workspaceId: string | null,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  novaBusinessWebOrigin: string | null = null,
): Promise<WorkspaceLookup> {
  const response = await postToNova(
    `${novaOrigin}/api/v1/integrations/replyn/workspaces/lookup`,
    { subjectType: session.subjectType, subjectId: session.subjectId, ...(workspaceId ? { workspaceId } : {}) },
    { [REPLYN_CLIENT_SECRET_HEADER]: clientSecret },
    fetchImpl,
    timeoutMs,
  );
  if (!response) return { kind: "unavailable" };
  // 404 chỉ có nghĩa "không có workspace này" khi hỏi một id; với danh sách đó là lỗi tích hợp.
  if (response.status === 404 && workspaceId) return { kind: "not_found" };
  if (response.status !== 200) return { kind: "unavailable" };
  const body = await readJsonObject(response);
  if (!body || !Array.isArray(body.workspaces) || body.workspaces.length > MAX_WORKSPACES) return { kind: "unavailable" };
  const workspaces: PublicWorkspace[] = [];
  for (const raw of body.workspaces) {
    const parsed = parseNovaWorkspace(raw, session.role, novaBusinessWebOrigin);
    if (!parsed) return { kind: "unavailable" };
    workspaces.push(parsed);
  }
  // Nova đã lọc theo workspaceId; kiểm tra lại để không bao giờ trả nhầm workspace khác.
  if (workspaceId && !workspaces.every((w) => w.workspaceId === workspaceId)) return { kind: "unavailable" };
  if (workspaceId && workspaces.length === 0) return { kind: "not_found" };
  return { kind: "ok", workspaces };
}

/**
 * GET /api/workspaces và GET /api/workspaces/{id}: workspace Replyn của người đang đăng nhập. Không có phiên
 * thì 401; workspace không tồn tại và workspace của người khác đều là 404.
 */
export async function handleWorkspaces(request: Request, deps: AuthDeps, workspaceId: string | null): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = readQrConfig(deps.env);
  if (!config) return json(503, { error: "not_configured" });
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  const session = verifySession(token, config.secret, Math.floor(deps.now() / 1000));
  if (!session) return json(401, { error: "unauthenticated" });
  if (workspaceId !== null && !UUID.test(workspaceId)) return json(404, { error: "not_found" });
  const result = await lookupNovaWorkspaces(
    config.novaOrigin,
    config.clientSecret,
    session,
    workspaceId?.toLowerCase() ?? null,
    deps.fetch,
    deps.timeoutMs ?? NOVA_TIMEOUT_MS,
    readNovaBusinessWebOrigin(deps.env),
  );
  if (result.kind === "not_found") return json(404, { error: "not_found" });
  if (result.kind === "unavailable") return json(503, { error: "unavailable" });
  return json(200, { workspaces: result.workspaces });
}
