// Kiểm thử dấu vân tay và chữ ký xác nhận của Replyn (thay cho niêm phong trên chuỗi khối), cùng phiên đăng nhập.
// Chạy: npm run test:agreement
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../workspace/ts-resolve.mjs", import.meta.url);
const { agreementHash, canonicalAgreement, readReceipt } = await import("../../src/lib/agreement/agreement.ts");
const { signReceipt, verifyAgreement } = await import("../../src/lib/agreement/receipt.ts");
const { agreementFromWorkspace } = await import("../../src/lib/agreement/fromWorkspace.ts");
const { signSession, verifySession, readSecret } = await import("../../src/lib/auth/session.ts");
const { reducer } = await import("../../src/lib/reducer.ts");
const { initialState } = await import("../../src/lib/seed.ts");

const SECRET = "x".repeat(40);
const OTHER = "y".repeat(40);
const NOW = new Date("2026-10-07T01:24:00.000Z");

const locked = () => reducer(initialState(), { type: "LOCK_TERMS", wsId: "ws-moc" });

test("an unconfirmed workspace has no agreement; a confirmed one maps to a canonical agreement", () => {
  const s = initialState();
  assert.equal(agreementFromWorkspace(s, s.workspaces["ws-moc"]), null);
  const after = locked();
  const a = agreementFromWorkspace(after, after.workspaces["ws-moc"]);
  assert.equal(a.workspaceId, "ws-moc");
  assert.equal(a.version, 1);
  assert.equal(a.businessName, "Trần Thu Hà");
  assert.equal(a.freelancerName, "Lê Minh Khoa");
  assert.equal(a.totalAmount, after.workspaces["ws-moc"].milestones.reduce((t, m) => t + m.amount, 0));
  assert.match(a.milestones[0].deadline, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(canonicalAgreement(JSON.parse(JSON.stringify(a))), a, "round-trips through JSON unchanged");
});

test("a genuine receipt matches; any edit to the terms is reported as modified", async () => {
  const s = locked();
  const a = agreementFromWorkspace(s, s.workspaces["ws-moc"]);
  const receipt = await signReceipt(a, SECRET, NOW);
  assert.equal(receipt.hash, await agreementHash(a));
  assert.deepEqual(readReceipt(JSON.parse(JSON.stringify(receipt))), receipt);
  assert.equal((await verifyAgreement(a, receipt, SECRET)).status, "match");
  const edited = { ...a, totalAmount: a.totalAmount + 1 };
  assert.equal((await verifyAgreement(edited, receipt, SECRET)).status, "modified");
});

test("a receipt from another key, for another workspace, or forged, is invalid; none is unsigned", async () => {
  const s = locked();
  const a = agreementFromWorkspace(s, s.workspaces["ws-moc"]);
  const receipt = await signReceipt(a, SECRET, NOW);
  assert.equal((await verifyAgreement(a, receipt, OTHER)).status, "invalid");
  assert.equal((await verifyAgreement({ ...a, workspaceId: "ws-khac" }, receipt, SECRET)).status, "invalid");
  // Kẻ sửa file tự tính lại mã băm cho khớp nội dung mới: chữ ký không còn đúng.
  const edited = { ...a, totalAmount: 1 };
  const forged = { ...receipt, hash: await agreementHash(edited) };
  assert.equal((await verifyAgreement(edited, forged, SECRET)).status, "invalid");
  assert.equal((await verifyAgreement(a, null, SECRET)).status, "unsigned");
});

test("changing the scope bumps the version and therefore the fingerprint", async () => {
  const s = locked();
  const ws = s.workspaces["ws-moc"];
  const a1 = agreementFromWorkspace(s, ws);
  const a2 = agreementFromWorkspace(s, { ...ws, version: 2 });
  assert.notEqual(await agreementHash(a1), await agreementHash(a2));
});

test("sessions: signed for an account, rejected when tampered, expired or signed with another key", () => {
  const now = 1_800_000_000;
  const token = signSession("u-ha", SECRET, now);
  assert.equal(verifySession(token, SECRET, now + 60)?.id, "u-ha");
  assert.equal(verifySession(token, OTHER, now + 60), null);
  assert.equal(verifySession(token, SECRET, now + 8 * 24 * 3600), null);
  const [payload, mac] = token.split(".");
  const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), uid: "u-khoa" })).toString("base64url");
  assert.equal(verifySession(`${swapped}.${mac}`, SECRET, now + 60), null);
  assert.equal(verifySession(signSession("u-nobody", SECRET, now), SECRET, now), null);
});

test("production refuses to run without a long enough session secret", () => {
  assert.equal(readSecret({ NODE_ENV: "production" }), null);
  assert.equal(readSecret({ NODE_ENV: "production", REPLYN_SESSION_SECRET: "short" }), null);
  assert.equal(readSecret({ NODE_ENV: "production", REPLYN_SESSION_SECRET: SECRET }), SECRET);
  assert.ok(readSecret({ NODE_ENV: "development" }));
});
