// Kiểm thử server workspace Replyn từ đề xuất Nova đã chấp nhận. Chạy: npm run test:auth
// Không dùng secret thật: mọi secret được sinh ngẫu nhiên khi chạy.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  handleWorkspaces,
  parseNovaWorkspace,
  readNovaBusinessWebOrigin,
  SESSION_COOKIE,
  signSession,
} from "../../src/lib/auth/server/novaBusinessAuth.ts";

const ORIGIN = "https://replyn.test";
const NOVA = "https://nova.test";
const SECRET = randomBytes(48).toString("base64url");
const CLIENT_SECRET = randomBytes(32).toString("base64url");
const NOW = Date.UTC(2026, 9, 5, 9, 0, 0);
const nowSec = Math.floor(NOW / 1000);
const CONTRACTOR = "contractor-6f1c2a9e-4b7d-4c3e-9a5f-0d8b7e6c5a41";
const ORG = "00000000-0000-0000-0000-000000000001";
const WORKSPACE = randomUUID();

const env = (overrides = {}) => ({ NOVA_API_URL: NOVA, REPLYN_SESSION_SECRET: SECRET, REPLYN_QR_CLIENT_SECRET: CLIENT_SECRET, NODE_ENV: "production", ...overrides });

function nova(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return respond(url, init);
  };
  return { fetch, calls };
}

const talentSession = () =>
  signSession({ v: 1, provider: "NOVA", iat: nowSec, exp: nowSec + 3600, subjectType: "TALENT", subjectId: CONTRACTOR, displayName: "Minh Anh", role: "freelancer" }, SECRET);
const businessSession = () =>
  signSession({ v: 1, provider: "NOVA", iat: nowSec, exp: nowSec + 3600, subjectType: "ORGANIZATION", subjectId: ORG, publicNovaId: "NVB-K7M2Q9XH", displayName: "Nova Labs", role: "business" }, SECRET);

function request(path, token, headers = {}) {
  return new Request(`${ORIGIN}${path}`, {
    headers: { ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}), "Sec-Fetch-Site": "same-origin", ...headers },
  });
}

const workspace = (overrides = {}) => ({
  workspaceId: WORKSPACE,
  proposalId: randomUUID(),
  projectName: "Landing page mùa thu",
  scope: "Thiết kế và code landing page.",
  deliverables: ["File Figma", "Mã nguồn"],
  revisionLimit: 2,
  currency: "USDC",
  totalAmount: 2500.0,
  startDate: "2026-10-12",
  deadline: "2026-11-10",
  reviewPeriodDays: 3,
  milestones: [
    { title: "Thiết kế", amount: 1000, deadline: "2026-10-25" },
    { title: "Code", amount: 1500, deadline: "2026-11-10" },
  ],
  notes: "",
  acceptedAt: new Date(NOW).toISOString(),
  businessName: "Nova Labs",
  freelancerName: "Minh Anh",
  viewerRole: "freelancer",
  ...overrides,
});

test("without a Replyn session nothing is asked from Nova", async () => {
  const backend = nova(() => Response.json({ workspaces: [] }));
  const res = await handleWorkspaces(request("/api/workspaces"), { env: env(), fetch: backend.fetch, now: () => NOW }, null);
  assert.equal(res.status, 401);
  assert.equal(backend.calls.length, 0);
});

test("Nova is asked with the identity from the signed session and only public fields come back", async () => {
  const backend = nova(() => Response.json({ workspaces: [workspace()] }));
  const res = await handleWorkspaces(request("/api/workspaces", talentSession()), { env: env(), fetch: backend.fetch, now: () => NOW }, null);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const [call] = backend.calls;
  assert.equal(call.url, `${NOVA}/api/v1/integrations/replyn/workspaces/lookup`);
  assert.equal(call.init.headers["X-Replyn-Client-Secret"], CLIENT_SECRET);
  assert.deepEqual(call.body, { subjectType: "TALENT", subjectId: CONTRACTOR });
  const body = await res.json();
  assert.equal(body.workspaces[0].workspaceId, WORKSPACE);
  assert.equal(body.workspaces[0].proposalId, undefined, "the proposal id stays on the server");
  const text = JSON.stringify(body);
  assert.ok(!text.includes(CONTRACTOR), "the internal Talent id never reaches the browser");
  assert.ok(!text.includes(CLIENT_SECRET));
});

test("a business opens one workspace by id and Nova checks membership", async () => {
  const backend = nova(() => Response.json({ workspaces: [workspace({ viewerRole: "business" })] }));
  const res = await handleWorkspaces(request(`/api/workspaces/${WORKSPACE}`, businessSession()), { env: env(), fetch: backend.fetch, now: () => NOW }, WORKSPACE);
  assert.equal(res.status, 200);
  assert.deepEqual(backend.calls[0].body, { subjectType: "ORGANIZATION", subjectId: ORG, workspaceId: WORKSPACE });
});

test("someone else's or an unknown workspace is 404, a malformed id never reaches Nova", async () => {
  const backend = nova(() => Response.json({ status: "NOT_FOUND" }, { status: 404 }));
  const deps = { env: env(), fetch: backend.fetch, now: () => NOW };
  assert.equal((await handleWorkspaces(request(`/api/workspaces/${WORKSPACE}`, talentSession()), deps, WORKSPACE)).status, 404);
  assert.equal((await handleWorkspaces(request("/api/workspaces/u-khoa", talentSession()), deps, "u-khoa")).status, 404);
  assert.equal(backend.calls.length, 1);
  // Cho danh sách, 404 từ Nova là lỗi tích hợp chứ không phải "không có workspace".
  assert.equal((await handleWorkspaces(request("/api/workspaces", talentSession()), deps, null)).status, 503);
});

test("data that does not match the session or the request is refused", async () => {
  const deps = (body) => ({ env: env(), fetch: nova(() => Response.json(body)).fetch, now: () => NOW });
  // Vai trò khác với phiên.
  assert.equal((await handleWorkspaces(request("/api/workspaces", talentSession()), deps({ workspaces: [workspace({ viewerRole: "business" })] }), null)).status, 503);
  // Nova trả nhầm workspace khác với id được hỏi.
  const other = workspace({ workspaceId: randomUUID() });
  assert.equal((await handleWorkspaces(request(`/api/workspaces/${WORKSPACE}`, talentSession()), deps({ workspaces: [other] }), WORKSPACE)).status, 503);
  // Tiền không hợp lệ.
  assert.equal((await handleWorkspaces(request("/api/workspaces", talentSession()), deps({ workspaces: [workspace({ totalAmount: -1 })] }), null)).status, 503);
});

test("cross-site requests and missing configuration are refused", async () => {
  const backend = nova(() => Response.json({ workspaces: [] }));
  const cross = request("/api/workspaces", talentSession(), { "Sec-Fetch-Site": "cross-site" });
  assert.equal((await handleWorkspaces(cross, { env: env(), fetch: backend.fetch, now: () => NOW }, null)).status, 403);
  const unconfigured = { env: env({ REPLYN_QR_CLIENT_SECRET: "" }), fetch: backend.fetch, now: () => NOW };
  assert.equal((await handleWorkspaces(request("/api/workspaces", talentSession()), unconfigured, null)).status, 503);
  assert.equal(backend.calls.length, 0);
});

/* ---------- quay lại cuộc trò chuyện trên Nova Business ---------- */

const THREAD = randomUUID();
const BUSINESS_WEB = "https://business.nova.test";

test("sourceThreadId is optional: workspaces from an older Nova backend are still accepted", () => {
  for (const role of ["business", "freelancer"]) {
    const parsed = parseNovaWorkspace(workspace({ viewerRole: role }), role, BUSINESS_WEB);
    assert.ok(parsed, role);
    assert.equal(parsed.novaReturnUrl, undefined);
    assert.equal(parsed.sourceThreadId, undefined);
  }
  // Id cuộc trò chuyện sai định dạng: bỏ qua liên kết, không loại workspace.
  for (const bad of ["not-a-uuid", 42, null, `${THREAD}/../x`]) {
    const parsed = parseNovaWorkspace(workspace({ viewerRole: "business", sourceThreadId: bad }), "business", BUSINESS_WEB);
    assert.ok(parsed, String(bad));
    assert.equal(parsed.novaReturnUrl, undefined);
  }
});

test("only the business gets a return URL, and only when NOVA_BUSINESS_WEB_URL is configured", () => {
  const biz = parseNovaWorkspace(workspace({ viewerRole: "business", sourceThreadId: THREAD }), "business", BUSINESS_WEB);
  assert.equal(biz.novaReturnUrl, `${BUSINESS_WEB}/business/messages?thread=${THREAD}`);
  assert.equal(biz.sourceThreadId, undefined, "the raw thread id is not passed through");

  const talent = parseNovaWorkspace(workspace({ sourceThreadId: THREAD }), "freelancer", BUSINESS_WEB);
  assert.equal(talent.novaReturnUrl, undefined);
  assert.ok(!JSON.stringify(talent).includes(THREAD), "the freelancer never receives the Nova thread id");

  const unconfigured = parseNovaWorkspace(workspace({ viewerRole: "business", sourceThreadId: THREAD }), "business", null);
  assert.equal(unconfigured.novaReturnUrl, undefined);
});

test("NOVA_BUSINESS_WEB_URL must be an https origin without a path", () => {
  const read = (value, NODE_ENV = "production") => readNovaBusinessWebOrigin({ NOVA_BUSINESS_WEB_URL: value, NODE_ENV });
  assert.equal(read("https://business.nova.test"), "https://business.nova.test");
  assert.equal(read("https://business.nova.test/"), "https://business.nova.test");
  assert.equal(read(undefined), null);
  assert.equal(read(""), null);
  assert.equal(read("not a url"), null);
  assert.equal(read("http://business.nova.test"), null);
  assert.equal(read("https://business.nova.test/business"), null);
  assert.equal(read("https://business.nova.test/?x=1"), null);
  assert.equal(read("https://business.nova.test/#x"), null);
  assert.equal(read("https://user:pass@business.nova.test"), null);
  assert.equal(read("javascript:alert(1)"), null);
  // http chỉ cho máy chủ trên chính máy khi không chạy production.
  assert.equal(read("http://localhost:3001", "production"), null);
  assert.equal(read("http://localhost:3001", "development"), "http://localhost:3001");
});

test("the workspaces API returns the return URL to the business and never the thread id to the freelancer", async () => {
  const configured = env({ NOVA_BUSINESS_WEB_URL: BUSINESS_WEB });
  const bizBackend = nova(() => Response.json({ workspaces: [workspace({ viewerRole: "business", sourceThreadId: THREAD })] }));
  const biz = await handleWorkspaces(request("/api/workspaces", businessSession()), { env: configured, fetch: bizBackend.fetch, now: () => NOW }, null);
  assert.equal(biz.status, 200);
  assert.equal((await biz.json()).workspaces[0].novaReturnUrl, `${BUSINESS_WEB}/business/messages?thread=${THREAD}`);

  const talentBackend = nova(() => Response.json({ workspaces: [workspace({ sourceThreadId: THREAD })] }));
  const talent = await handleWorkspaces(request("/api/workspaces", talentSession()), { env: configured, fetch: talentBackend.fetch, now: () => NOW }, null);
  assert.equal(talent.status, 200);
  const text = await talent.text();
  assert.ok(!text.includes(THREAD));
  assert.ok(!text.includes("novaReturnUrl"));

  const noEnv = await handleWorkspaces(request("/api/workspaces", businessSession()), { env: env(), fetch: bizBackend.fetch, now: () => NOW }, null);
  assert.equal((await noEnv.json()).workspaces[0].novaReturnUrl, undefined);
});
