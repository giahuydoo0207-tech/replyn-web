// Kiểm thử server đăng nhập Replyn bằng mã QR (Nova Mobile xác nhận). Chạy: npm run test:auth
// Không dùng secret thật: mọi secret được sinh ngẫu nhiên khi chạy.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  handleQrCreate,
  handleQrPoll,
  handleSession,
  QR_COOKIE,
  REMEMBERED_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signPairingCookie,
  signSession,
  verifyPairingCookie,
  verifySession,
} from "../../src/lib/auth/server/novaBusinessAuth.ts";

const ORIGIN = "https://replyn.test";
const NOVA = "https://nova.test";
const SECRET = randomBytes(48).toString("base64url");
const CLIENT_SECRET = randomBytes(32).toString("base64url");
const NOW = Date.UTC(2026, 9, 5, 9, 0, 0);
const nowSec = Math.floor(NOW / 1000);
const secret43 = () => randomBytes(32).toString("base64url");
const CONTRACTOR = "contractor-6f1c2a9e-4b7d-4c3e-9a5f-0d8b7e6c5a41";

function env(overrides = {}) {
  return { NOVA_API_URL: NOVA, REPLYN_SESSION_SECRET: SECRET, REPLYN_QR_CLIENT_SECRET: CLIENT_SECRET, NODE_ENV: "production", ...overrides };
}

function deps(fetch, extra = {}) {
  return { env: env(), fetch, now: () => NOW, ...extra };
}

/** fetch giả của Nova backend; ghi lại các lần gọi. */
function nova(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return respond(url, init);
  };
  return { fetch, calls };
}

function created(overrides = {}) {
  const pairing = {
    pairingId: randomUUID(),
    qrSecret: secret43(),
    browserSecret: secret43(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    action: "login",
    ...overrides,
  };
  return { pairing, response: () => Response.json(pairing, { status: 201 }) };
}

const consumed = (identity = {}) =>
  Response.json({
    status: "CONSUMED",
    identity: { provider: "NOVA", subjectType: "TALENT", subjectId: CONTRACTOR, displayName: "Minh Anh", role: "freelancer", ...identity },
    approvedAt: new Date(NOW).toISOString(),
  });

function createRequest({ origin = ORIGIN } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  return new Request(`${ORIGIN}/api/auth/nova/qr`, { method: "POST", headers });
}

function pollRequest(cookie, { query = "", headers = {} } = {}) {
  return new Request(`${ORIGIN}/api/auth/nova/qr${query}`, {
    headers: { ...(cookie ? { Cookie: `other=1; ${QR_COOKIE}=${cookie}` } : {}), "Sec-Fetch-Site": "same-origin", ...headers },
  });
}

function setCookies(res) {
  return res.headers.getSetCookie();
}

const valueOf = (cookies, name) => cookies.find((c) => c.startsWith(`${name}=`))?.match(new RegExp(`^${name}=([^;]*)`))[1];

/** Tạo mã QR thành công và trả về cookie challenge cùng dữ liệu Nova đã cấp. */
async function start() {
  const { pairing, response } = created();
  const backend = nova(response);
  const res = await handleQrCreate(createRequest(), deps(backend.fetch));
  assert.equal(res.status, 200);
  return { pairing, cookie: valueOf(setCookies(res), QR_COOKIE), res, backend };
}

test("creating a QR code asks Nova server-to-server and only returns the QR URL", async () => {
  const { pairing, response } = created();
  const backend = nova(response);
  const res = await handleQrCreate(createRequest(), deps(backend.fetch));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const json = await res.json();
  const exp = Math.floor(Date.parse(pairing.expiresAt) / 1000);
  assert.equal(
    json.qrUrl,
    `${ORIGIN}/auth/nova?pairing=${pairing.pairingId}&secret=${pairing.qrSecret}&exp=${exp}&action=login`,
  );
  assert.equal(json.expiresAt, pairing.expiresAt);
  assert.deepEqual(Object.keys(json).sort(), ["expiresAt", "qrUrl"]);
  const text = JSON.stringify(json);
  assert.ok(!text.includes(pairing.browserSecret), "browserSecret never reaches JavaScript");
  assert.ok(!text.includes(CLIENT_SECRET));

  assert.equal(backend.calls.length, 1);
  const [call] = backend.calls;
  assert.equal(call.url, `${NOVA}/api/v1/integrations/replyn/pairings`);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.cache, "no-store");
  assert.equal(call.init.redirect, "error");
  assert.equal(call.init.headers["X-Replyn-Client-Secret"], CLIENT_SECRET);
  assert.deepEqual(call.body, { action: "login" });
});

test("the pairing cookie is HttpOnly, Secure, SameSite=Lax, scoped, 60 seconds and signed", async () => {
  const { pairing, cookie, res } = await start();
  const header = setCookies(res).find((c) => c.startsWith(`${QR_COOKIE}=`));
  assert.match(header, /; HttpOnly/);
  assert.match(header, /; Secure/);
  assert.match(header, /; SameSite=Lax/);
  assert.match(header, /; Max-Age=60/);
  assert.match(header, /; Path=\/api\/auth\/nova\/qr/);
  assert.ok(!header.includes(CLIENT_SECRET) && !header.includes(pairing.qrSecret));
  const value = verifyPairingCookie(cookie, SECRET, nowSec);
  assert.equal(value.p, pairing.pairingId);
  assert.equal(value.b, pairing.browserSecret);
  // chữ ký sai, payload sửa, hoặc ký bằng secret khác đều bị từ chối
  const [payload, signature] = cookie.split(".");
  assert.equal(verifyPairingCookie(`${payload}.${signature.slice(0, -2)}AA`, SECRET, nowSec), null);
  assert.equal(verifyPairingCookie(cookie, randomBytes(48).toString("base64url"), nowSec), null);
  assert.equal(verifyPairingCookie(cookie, SECRET, nowSec + 61), null, "expires with the challenge");

  const dev = await handleQrCreate(createRequest(), { ...deps(created().response), env: env({ NODE_ENV: "development" }) });
  assert.doesNotMatch(setCookies(dev).join("\n"), /Secure/);
});

test("pairing cookies and session cookies cannot stand in for each other", async () => {
  const { cookie } = await start();
  assert.equal(verifySession(cookie, SECRET, nowSec), null);
  const session = signSession(
    { v: 1, provider: "NOVA", subjectType: "TALENT", subjectId: CONTRACTOR, displayName: "Minh Anh", role: "freelancer", iat: nowSec, exp: nowSec + 60 },
    SECRET,
  );
  assert.equal(verifyPairingCookie(session, SECRET, nowSec), null);
});

test("creating a code requires the Replyn origin and full configuration", async () => {
  const backend = nova(created().response);
  for (const origin of [null, "https://evil.example", "http://replyn.test"]) {
    const res = await handleQrCreate(createRequest({ origin }), deps(backend.fetch));
    assert.equal(res.status, 403, String(origin));
    assert.equal(setCookies(res).length, 0);
  }
  for (const bad of [
    { REPLYN_QR_CLIENT_SECRET: undefined },
    { REPLYN_QR_CLIENT_SECRET: "short" },
    { REPLYN_SESSION_SECRET: undefined },
    { NOVA_API_URL: "http://nova.example.com" },
  ]) {
    const res = await handleQrCreate(createRequest(), { ...deps(backend.fetch), env: env(bad) });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "not_configured" });
  }
  assert.equal(backend.calls.length, 0);
});

test("an unexpected answer from Nova never produces a QR code", async () => {
  const bad = [
    () => new Response("boom", { status: 500 }),
    () => Response.json({ message: "Replyn client authentication failed." }, { status: 401 }),
    () => Response.json(created().pairing, { status: 200 }),
    () => created({ pairingId: "not-a-uuid" }).response(),
    () => created({ qrSecret: "short" }).response(),
    () => created({ browserSecret: undefined }).response(),
    () => created({ expiresAt: new Date(NOW - 1000).toISOString() }).response(),
    () => created({ expiresAt: new Date(NOW + 10 * 60_000).toISOString() }).response(),
    () => {
      throw new TypeError("fetch failed");
    },
  ];
  for (const respond of bad) {
    const res = await handleQrCreate(createRequest(), deps(nova(respond).fetch));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "unavailable" });
    assert.equal(setCookies(res).length, 0);
  }
  const same = secret43();
  const res = await handleQrCreate(createRequest(), deps(nova(created({ qrSecret: same, browserSecret: same }).response).fetch));
  assert.equal(res.status, 503, "the two secrets must be independent");
});

test("polling while Nova Mobile has not confirmed returns 202 and keeps the cookie", async () => {
  const { pairing, cookie } = await start();
  const backend = nova(() => Response.json({ status: "PENDING" }, { status: 202 }));
  const res = await handleQrPoll(pollRequest(cookie), deps(backend.fetch));
  assert.equal(res.status, 202);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { status: "pending" });
  assert.equal(setCookies(res).length, 0);
  const [call] = backend.calls;
  assert.equal(call.url, `${NOVA}/api/v1/integrations/replyn/pairings/${pairing.pairingId}/consume`);
  assert.equal(call.init.headers["X-Replyn-Client-Secret"], CLIENT_SECRET);
  assert.deepEqual(call.body, { browserSecret: pairing.browserSecret });
});

test("an approved code creates a Talent session, clears the pairing cookie and hides the subject ID", async () => {
  const { cookie } = await start();
  const res = await handleQrPoll(pollRequest(cookie), deps(nova(() => consumed()).fetch));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.identity, { provider: "NOVA", subjectType: "TALENT", displayName: "Minh Anh", role: "freelancer", verifiedBy: "NOVA_MOBILE" });
  assert.equal(json.expiresAt, new Date((nowSec + SESSION_TTL_SECONDS) * 1000).toISOString());
  assert.ok(!JSON.stringify(json).includes(CONTRACTOR), "subjectId stays on the server");

  const cookies = setCookies(res);
  const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  assert.match(session, /; HttpOnly/);
  assert.match(session, /; SameSite=Lax/);
  assert.match(session, /; Secure/);
  assert.doesNotMatch(session, /Max-Age/, "without remember the session ends with the browser");
  assert.match(cookies.find((c) => c.startsWith(`${QR_COOKIE}=`)), /Max-Age=0/);

  // refresh: phiên Talent đọc lại từ cookie
  const token = valueOf(cookies, SESSION_COOKIE);
  const restored = handleSession(
    new Request(`${ORIGIN}/api/auth/session`, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } }),
    deps(null, { now: () => NOW + 60 * 60 * 1000 }),
  );
  const body = await restored.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.identity.role, "freelancer");
  assert.equal(body.identity.displayName, "Minh Anh");
  assert.equal(body.identity.subjectId, undefined);
  assert.equal(body.identity.publicNovaId, undefined, "Talent has no Nova ID");
});

test("remember device keeps the Talent session for 7 days", async () => {
  const { cookie } = await start();
  const res = await handleQrPoll(pollRequest(cookie, { query: "?remember=1" }), deps(nova(() => consumed()).fetch));
  const session = setCookies(res).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  assert.match(session, new RegExp(`Max-Age=${REMEMBERED_SESSION_TTL_SECONDS}`));
});

test("expired, replayed and unknown codes end the login and clear the cookie", async () => {
  const { cookie } = await start();
  for (const [status, expected, code] of [
    [410, { status: "expired" }, 410],
    [404, { status: "expired" }, 410],
    [409, { status: "used" }, 409],
  ]) {
    const res = await handleQrPoll(pollRequest(cookie), deps(nova(() => Response.json({}, { status })).fetch));
    assert.equal(res.status, code, String(status));
    assert.deepEqual(await res.json(), expected);
    assert.match(setCookies(res).join("\n"), new RegExp(`${QR_COOKIE}=;.*Max-Age=0`));
    assert.ok(!setCookies(res).some((c) => c.startsWith(`${SESSION_COOKIE}=`)));
  }

  // không có cookie, cookie hết hạn hoặc bị sửa: không cần hỏi Nova
  const backend = nova(() => consumed());
  for (const [value, when] of [[null, NOW], [cookie, NOW + 61_000], [`${cookie}x`, NOW]]) {
    const res = await handleQrPoll(pollRequest(value), deps(backend.fetch, { now: () => when }));
    assert.equal(res.status, 410);
  }
  assert.equal(backend.calls.length, 0);
});

test("a temporary Nova failure keeps the cookie so the next poll can retry", async () => {
  const { cookie } = await start();
  for (const respond of [() => new Response("boom", { status: 500 }), () => Response.json({}, { status: 401 }), () => {
    throw new TypeError("offline");
  }]) {
    const res = await handleQrPoll(pollRequest(cookie), deps(nova(respond).fetch));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "unavailable" });
    assert.equal(setCookies(res).length, 0);
  }
});

test("only a well-formed Talent identity from Nova is trusted", async () => {
  const { cookie } = await start();
  for (const change of [
    { subjectType: "ORGANIZATION" },
    { role: "business" },
    { provider: "OTHER" },
    { subjectId: "../../etc" },
    { subjectId: "" },
    { displayName: "" },
    { displayName: "x".repeat(161) },
  ]) {
    const res = await handleQrPoll(pollRequest(cookie), deps(nova(() => consumed(change)).fetch));
    assert.equal(res.status, 503, JSON.stringify(change));
    assert.ok(!setCookies(res).some((c) => c.startsWith(`${SESSION_COOKIE}=`)));
  }
  const named = await handleQrPoll(pollRequest(cookie), deps(nova(() => consumed({ displayName: " Minh\u0000 Anh\n" })).fetch));
  assert.equal((await named.json()).identity.displayName, "Minh Anh");
});

test("polling from another site is refused", async () => {
  const { cookie } = await start();
  const backend = nova(() => consumed());
  for (const headers of [{ "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" }, { Origin: "https://evil.example" }]) {
    const res = await handleQrPoll(pollRequest(cookie, { headers }), deps(backend.fetch));
    assert.equal(res.status, 403, JSON.stringify(headers));
  }
  assert.equal(backend.calls.length, 0);
});

test("Talent sessions cannot be promoted or mixed with Business fields", () => {
  const base = { v: 1, provider: "NOVA", subjectType: "TALENT", subjectId: CONTRACTOR, displayName: "Minh Anh", role: "freelancer", iat: nowSec, exp: nowSec + 60 };
  assert.ok(verifySession(signSession(base, SECRET), SECRET, nowSec));
  assert.equal(verifySession(signSession({ ...base, role: "business" }, SECRET), SECRET, nowSec), null);
  assert.equal(verifySession(signSession({ ...base, publicNovaId: "NVB-K7M2Q9XH" }, SECRET), SECRET, nowSec), null);
  assert.equal(verifySession(signSession({ ...base, subjectId: "a b" }, SECRET), SECRET, nowSec), null);
  assert.equal(verifySession(signSession({ ...base, subjectType: "ORGANIZATION" }, SECRET), SECRET, nowSec), null);
  // cookie challenge ký đúng nhưng sai định dạng
  assert.equal(verifyPairingCookie(signPairingCookie({ v: 1, p: "x", b: secret43(), exp: nowSec + 30 }, SECRET), SECRET, nowSec), null);
});
