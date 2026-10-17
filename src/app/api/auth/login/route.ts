import { accountByEmail, DEMO_PASSWORD } from "@/lib/auth/accounts";
import { isSecure, readSecret, sessionCookie, signSession } from "@/lib/auth/session";
import { timingSafeEqual } from "node:crypto";

const json = (status: number, body: unknown, cookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });

const samePassword = (given: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(DEMO_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Đăng nhập bằng email và mật khẩu của tài khoản mẫu. */
export async function POST(request: Request) {
  const secret = readSecret();
  if (!secret) return json(503, { error: "not_configured" });
  const raw = await request.text();
  if (raw.length > 2048) return json(413, { error: "too_large" });
  let body: { email?: unknown; password?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" });
  }
  const account = accountByEmail(body.email);
  if (!account || typeof body.password !== "string" || !samePassword(body.password)) {
    return json(401, { error: "invalid_credentials" });
  }
  const token = signSession(account.id, secret, Math.floor(Date.now() / 1000));
  return json(200, { account: { id: account.id, name: account.name, role: account.role } }, sessionCookie(token, isSecure(request)));
}
