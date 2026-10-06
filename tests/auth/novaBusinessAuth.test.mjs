// Kiểm thử server đăng nhập Nova Business. Chạy: npm run test:auth
// Không dùng Nova Key hay secret thật: mọi giá trị được sinh ngẫu nhiên khi chạy.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  clearSessionCookie,
  handleBusinessLogin,
  handleLogout,
  handleSession,
  NOVA_BUSINESS_ID_PATTERN,
  NOVA_KEY_PATTERN,
  REMEMBERED_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
} from "../../src/lib/auth/server/novaBusinessAuth.ts";
import * as client from "../../src/lib/auth/novaBusinessClient.ts";

const ORIGIN = "https://replyn.test";
const NOVA = "https://nova.test";
const NOVA_ID = "NVB-K7M2Q9XH";
const SUBJECT = "0f8fad5b-d9cb-469f-a165-70867728950e";
const key = () => `nvk_${randomBytes(32).toString("base64url")}`;
const SECRET = randomBytes(48).toString("base64url");
const NOW = Date.UTC(2026, 9, 5, 9, 0, 0);
const nowSec = Math.floor(NOW / 1000);

function env(overrides = {}) {
  return { NOVA_API_URL: NOVA, REPLYN_SESSION_SECRET: SECRET, NODE_ENV: "production", ...overrides };
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

const ok = (body = {}) =>
  Response.json({
    verified: true,
    subjectType: "ORGANIZATION",
    subjectId: SUBJECT,
    publicNovaId: NOVA_ID,
    displayName: "Nova Labs",
    verifiedAt: new Date(NOW).toISOString(),
    ...body,
  });

function loginRequest(body, { contentType = "application/json", origin = ORIGIN } = {}) {
  const headers = { "Content-Type": contentType };
  if (origin) headers.Origin = origin;
  return new Request(`${ORIGIN}/api/auth/nova/business`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deps(fetch, extra = {}) {
  return { env: env(), fetch, now: () => NOW, ...extra };
}

const tokenOf = (setCookie) => setCookie.match(new RegExp(`^${SESSION_COOKIE}=([^;]*)`))[1];
const payloadOf = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));

function sessionRequest(token) {
  return new Request(`${ORIGIN}/api/auth/session`, { headers: token ? { Cookie: `other=1; ${SESSION_COOKIE}=${token}` } : {} });
}

async function login(fetchImpl, body, extra) {
  const res = await handleBusinessLogin(loginRequest(body), deps(fetchImpl, extra));
  return { res, json: await res.json() };
}

test("a real 8-character Nova ID and key create a Business session", async () => {
  const novaKey = key();
  const backend = nova(() => ok());
  const { res, json } = await login(backend.fetch, { novaId: " nvb-k7m2q9xh ", novaKey });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(json.identity, {
    provider: "NOVA",
    subjectType: "ORGANIZATION",
    publicNovaId: NOVA_ID,
    displayName: "Nova Labs",
    role: "business",
  });
  assert.equal(json.expiresAt, new Date((nowSec + SESSION_TTL_SECONDS) * 1000).toISOString());
  // gọi đúng endpoint, ID đã chuẩn hóa, Key giữ nguyên văn, không cache
  assert.equal(backend.calls.length, 1);
  const [call] = backend.calls;
  assert.equal(call.url, `${NOVA}/api/v1/nova-credentials/verify`);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.cache, "no-store");
  assert.ok(call.init.signal instanceof AbortSignal);
  assert.deepEqual(call.body, { novaId: NOVA_ID, novaKey });
  // phản hồi cho trình duyệt không có Key, subjectId hay chữ ký
  const text = JSON.stringify(json);
  assert.ok(!text.includes(novaKey) && !text.includes(SUBJECT));
});

test("the session cookie is HttpOnly, SameSite=Lax, Secure in production and holds no key", async () => {
  const novaKey = key();
  const { res } = await login(nova(() => ok()).fetch, { novaId: NOVA_ID, novaKey });
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Lax/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; Path=\//);
  assert.doesNotMatch(cookie, /Max-Age/, "without remember the cookie ends with the browser session");
  assert.ok(!cookie.includes(novaKey) && !cookie.includes(novaKey.slice(4)));
  const payload = payloadOf(tokenOf(cookie));
  assert.deepEqual(Object.keys(payload).sort(), ["displayName", "exp", "iat", "provider", "publicNovaId", "role", "subjectId", "subjectType", "v"]);
  assert.equal(payload.exp - payload.iat, SESSION_TTL_SECONDS);
  assert.ok(!JSON.stringify(payload).includes(novaKey));

  // ngoài production (máy dev http) không đặt Secure
  const dev = await handleBusinessLogin(loginRequest({ novaId: NOVA_ID, novaKey }), {
    ...deps(nova(() => ok()).fetch),
    env: env({ NODE_ENV: "development" }),
  });
  assert.doesNotMatch(dev.headers.get("set-cookie"), /Secure/);
});

test("remember device only extends the cookie lifetime", async () => {
  const { res, json } = await login(nova(() => ok()).fetch, { novaId: NOVA_ID, novaKey: key(), remember: true });
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`Max-Age=${REMEMBERED_SESSION_TTL_SECONDS}`));
  assert.equal(json.expiresAt, new Date((nowSec + REMEMBERED_SESSION_TTL_SECONDS) * 1000).toISOString());
});

test("old 5-character demo IDs and malformed input never reach Nova", async () => {
  const backend = nova(() => ok());
  const cases = [
    { novaId: "NVB-7K29Q", novaKey: key() },
    { novaId: "NVB-K7M2Q9XI", novaKey: key() }, // I is not in the Nova ID alphabet
    { novaId: "NVF-K7M2Q9XH", novaKey: key() },
    { novaId: NOVA_ID, novaKey: "DEMO-2026" },
    { novaId: NOVA_ID, novaKey: `${key()} ` }, // Nova Key is not trimmed
    { novaId: NOVA_ID, novaKey: key().slice(0, 40) },
    { novaId: NOVA_ID },
    { novaKey: key() },
    { novaId: 12345678, novaKey: key() },
    { novaId: NOVA_ID, novaKey: key(), remember: "yes" },
    [],
    "null",
    "{not json",
  ];
  for (const body of cases) {
    const { res, json } = await login(backend.fetch, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(json, { error: "invalid_input" });
    assert.equal(res.headers.get("set-cookie"), null);
  }
  assert.equal(backend.calls.length, 0);
});

test("only JSON from this origin and within the size limit is accepted", async () => {
  const backend = nova(() => ok());
  const body = { novaId: NOVA_ID, novaKey: key() };
  const form = await handleBusinessLogin(loginRequest(body, { contentType: "text/plain" }), deps(backend.fetch));
  assert.equal(form.status, 415);
  const cross = await handleBusinessLogin(loginRequest(body, { origin: "https://evil.example" }), deps(backend.fetch));
  assert.equal(cross.status, 403);
  const big = await handleBusinessLogin(loginRequest({ ...body, padding: "x".repeat(5000) }), deps(backend.fetch));
  assert.equal(big.status, 413);
  assert.equal(backend.calls.length, 0);
});

test("wrong or revoked credentials get one generic 401", async () => {
  const backend = nova(() => Response.json({ message: "Nova ID or Nova Key is invalid.", internal: "row 42" }, { status: 401 }));
  const novaKey = key();
  const { res, json } = await login(backend.fetch, { novaId: NOVA_ID, novaKey });
  assert.equal(res.status, 401);
  assert.deepEqual(json, { error: "invalid_credentials" });
  assert.equal(res.headers.get("set-cookie"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("Nova being down, slow or failing is reported as unavailable, without details", async () => {
  const failures = [
    () => new Response("boom: stack trace", { status: 500 }),
    () => new Response("<html>bad gateway</html>", { status: 502 }),
    () => Response.json({}, { status: 429 }),
    () => Response.json({ error: "bad request" }, { status: 400 }),
    () => {
      throw new TypeError("fetch failed: connect ECONNREFUSED");
    },
  ];
  for (const respond of failures) {
    const { res, json } = await login(nova(respond).fetch, { novaId: NOVA_ID, novaKey: key() });
    assert.equal(res.status, 503);
    assert.deepEqual(json, { error: "unavailable" });
  }

  // quá thời gian chờ: fetch chỉ kết thúc khi bị abort
  const hanging = async (_url, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
  const started = Date.now();
  // Timer của AbortSignal.timeout không giữ event loop (unref); một timer thường giữ tiến trình sống tới khi
  // fetch bị abort, nếu không Node 22 coi test chưa xong và hủy các test còn lại.
  const keepAlive = setTimeout(() => {}, 5000);
  try {
    const { res } = await login(hanging, { novaId: NOVA_ID, novaKey: key() }, { timeoutMs: 50 });
    assert.equal(res.status, 503);
    assert.ok(Date.now() - started < 2000);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("a 200 from Nova is only trusted when it matches the expected identity", async () => {
  const bad = [
    { verified: false },
    { verified: "true" },
    { subjectType: "TALENT" },
    { subjectType: "PERSON" },
    { subjectId: "not-a-uuid" },
    { subjectId: undefined },
    { publicNovaId: "NVB-ZZZZZZZZ" },
    { displayName: "" },
    { displayName: "x".repeat(161) },
    { displayName: 42 },
  ];
  for (const change of bad) {
    const { res, json } = await login(nova(() => ok(change)).fetch, { novaId: NOVA_ID, novaKey: key() });
    assert.equal(res.status, 503, JSON.stringify(change));
    assert.deepEqual(json, { error: "unavailable" });
    assert.equal(res.headers.get("set-cookie"), null);
  }
  const notJson = await login(nova(() => new Response("ok", { status: 200 })).fetch, { novaId: NOVA_ID, novaKey: key() });
  assert.equal(notJson.res.status, 503);
  // ký tự điều khiển trong tên bị loại bỏ
  const named = await login(nova(() => ok({ displayName: " Nova\u0000 Labs\n" })).fetch, { novaId: NOVA_ID, novaKey: key() });
  assert.equal(named.json.identity.displayName, "Nova Labs");
});

test("missing or unsafe server configuration fails closed, without calling Nova", async () => {
  const backend = nova(() => ok());
  for (const bad of [
    { NOVA_API_URL: undefined },
    { REPLYN_SESSION_SECRET: undefined },
    { REPLYN_SESSION_SECRET: "too-short-secret" },
    { NOVA_API_URL: "http://nova.example.com" },
    { NOVA_API_URL: "not a url" },
    { NOVA_API_URL: "https://user:pass@nova.test" },
  ]) {
    const res = await handleBusinessLogin(loginRequest({ novaId: NOVA_ID, novaKey: key() }), {
      ...deps(backend.fetch),
      env: env(bad),
    });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "not_configured" });
  }
  assert.equal(backend.calls.length, 0);
  const noSecret = handleSession(sessionRequest(null), { ...deps(backend.fetch), env: env({ REPLYN_SESSION_SECRET: undefined }) });
  assert.equal(noSecret.status, 503);
});

test("refresh restores the Business session from the cookie", async () => {
  const { res } = await login(nova(() => ok()).fetch, { novaId: NOVA_ID, novaKey: key() });
  const token = tokenOf(res.headers.get("set-cookie"));
  const later = handleSession(sessionRequest(token), deps(null, { now: () => NOW + 60 * 60 * 1000 }));
  assert.equal(later.status, 200);
  assert.equal(later.headers.get("cache-control"), "no-store");
  const body = await later.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.identity.publicNovaId, NOVA_ID);
  assert.equal(body.identity.role, "business");
  assert.equal(body.identity.subjectId, undefined);

  const none = handleSession(sessionRequest(null), deps(null));
  assert.deepEqual(await none.json(), { authenticated: false });
});

test("tampered, re-signed or expired sessions are rejected and cleared", async () => {
  const { res } = await login(nova(() => ok()).fetch, { novaId: NOVA_ID, novaKey: key() });
  const token = tokenOf(res.headers.get("set-cookie"));
  const [payload, signature] = token.split(".");

  const promoted = Buffer.from(JSON.stringify({ ...payloadOf(token), displayName: "Admin", exp: nowSec + 9e6 })).toString("base64url");
  const forged = signSession({ ...payloadOf(token) }, randomBytes(48).toString("base64url"));
  for (const bad of [
    `${promoted}.${signature}`,
    `${payload}.${signature.slice(0, -2)}AA`,
    forged,
    `${payload}`,
    "garbage",
  ]) {
    const r = handleSession(sessionRequest(bad), deps(null));
    assert.deepEqual(await r.json(), { authenticated: false }, bad);
    assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
  }

  const expired = handleSession(sessionRequest(token), deps(null, { now: () => NOW + (SESSION_TTL_SECONDS + 1) * 1000 }));
  assert.deepEqual(await expired.json(), { authenticated: false });
  assert.equal(verifySession(token, SECRET, nowSec + SESSION_TTL_SECONDS + 1), null);

  // phiên ký đúng nhưng sai vai hoặc thời hạn quá dài cũng bị từ chối
  const base = payloadOf(token);
  assert.equal(verifySession(signSession({ ...base, role: "freelancer" }, SECRET), SECRET, nowSec), null);
  assert.equal(verifySession(signSession({ ...base, exp: base.iat + REMEMBERED_SESSION_TTL_SECONDS + 1 }, SECRET), SECRET, nowSec), null);
  assert.equal(verifySession(signSession({ ...base, v: 2 }, SECRET), SECRET, nowSec), null);
});

test("logout clears the cookie and rejects cross-site requests", async () => {
  const res = handleLogout(new Request(`${ORIGIN}/api/auth/logout`, { method: "POST", headers: { Origin: ORIGIN } }), deps(null));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { authenticated: false });
  const cookie = res.headers.get("set-cookie");
  assert.equal(cookie, clearSessionCookie({ secure: true }));
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=;`));
  assert.match(cookie, /Max-Age=0/);
  const cross = handleLogout(new Request(`${ORIGIN}/api/auth/logout`, { method: "POST", headers: { Origin: "https://evil.example" } }), deps(null));
  assert.equal(cross.status, 403);
});

test("the browser logout helper only reports success when the server cleared the session", async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const respondWith = (make) => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url, method: init?.method });
      return make();
    };
  };
  respondWith(() => Response.json({ authenticated: false }));
  assert.equal(await client.logoutBusiness(), true);
  assert.deepEqual(calls.at(-1), { url: "/api/auth/logout", method: "POST" });
  respondWith(() => new Response("", { status: 500 }));
  assert.equal(await client.logoutBusiness(), false);
  respondWith(() => Response.json({ error: "forbidden" }, { status: 403 }));
  assert.equal(await client.logoutBusiness(), false);
  respondWith(() => {
    throw new TypeError("network down");
  });
  assert.equal(await client.logoutBusiness(), false);
});

test("browser and server agree on the Nova ID and Nova Key formats", () => {
  assert.equal(client.NOVA_BUSINESS_ID_PATTERN.source, NOVA_BUSINESS_ID_PATTERN.source);
  assert.equal(client.NOVA_KEY_PATTERN.source, NOVA_KEY_PATTERN.source);
  assert.equal(client.normalizeBusinessNovaId("  nvb k7m2 q9xh "), NOVA_ID);
  assert.equal(client.normalizeBusinessNovaId("nvb-7k29q"), "NVB-7K29Q");
});
