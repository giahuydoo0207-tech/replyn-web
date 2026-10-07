// Kiểm thử nhắc hạn tự động: đúng mốc, mỗi mốc một lần, nhắc lại khi đổi hạn, không nhắc giai đoạn đã xong.
// Chạy: npm test
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./ts-resolve.mjs", import.meta.url);
const { reducer, wsChatId } = await import("../../src/lib/reducer.ts");
const { initialState } = await import("../../src/lib/seed.ts");
const { dueReminders } = await import("../../src/lib/reminders.ts");

const DAY = 86_400_000;
const at = (d, h = 9) => Date.UTC(2026, 9, d, h - 7); // giờ Việt Nam, tháng 10/2026
const names = { business: "Thu Hà", freelancer: "Minh Khoa" };
const ms = (over = {}) => ({
  id: "m1", title: "Thiết kế UI", amount: 1000, status: "awaiting_funding", deadline: "15/10/2026",
  reviewDays: 3, revisionLimit: 2, revisionsUsed: 0, criteria: [], submissionIds: [], ...over,
});
const ws = (milestones, extra = {}) => ({ id: "w", milestones, submissions: [], termsLockedAt: 1, ...extra });

test("reminds at 3 days, 1 day and when overdue, saying who has to act", () => {
  assert.equal(dueReminders(ws([ms()]), at(11), names).length, 0, "4 days left: nothing yet");
  const d3 = dueReminders(ws([ms()]), at(12), names);
  assert.equal(d3.length, 1);
  assert.match(d3[0].text, /còn 3 ngày tới hạn \(15\/10\)\. Đang chờ Thu Hà ký quỹ/);
  assert.equal(d3[0].tone, "info");
  const d1 = dueReminders(ws([ms({ status: "funded_sim" })]), at(14), names);
  assert.match(d1[0].text, /còn 1 ngày tới hạn.*Đang chờ Minh Khoa nộp sản phẩm/);
  assert.match(dueReminders(ws([ms()]), at(15), names)[0].text, /đến hạn hôm nay/);
  const over = dueReminders(ws([ms()]), at(17), names);
  assert.match(over[0].text, /đã quá hạn 2 ngày/);
  assert.equal(over[0].tone, "danger");
});

test("before the agreement is confirmed, the reminder asks both sides to confirm it", () => {
  assert.match(dueReminders(ws([ms()], { termsLockedAt: null }), at(12), names)[0].text, /Đang chờ hai bên xác nhận thỏa thuận/);
});

test("each stage is sent once; skipping ahead sends only the most urgent one", () => {
  const first = dueReminders(ws([ms()]), at(14), names);
  assert.equal(first.length, 1, "opening the app 1 day before the deadline sends one reminder, not two");
  assert.equal(dueReminders(ws([ms()], { reminded: first.map((r) => r.key) }), at(14, 18), names).length, 0);
});

test("a new deadline from a scope change starts the reminders over", () => {
  const sent = dueReminders(ws([ms()]), at(12), names).map((r) => r.key);
  assert.equal(dueReminders(ws([ms({ deadline: "15/10/2026" })], { reminded: sent }), at(12), names).length, 0);
  assert.equal(dueReminders(ws([ms({ deadline: "20/10/2026" })], { reminded: sent }), at(17), names).length, 1);
});

test("finished, disputed or submitted milestones get no deadline reminder", () => {
  for (const status of ["released_sim", "disputed", "ready_to_release", "refunded", "split"]) {
    assert.equal(dueReminders(ws([ms({ status })]), at(20), names).length, 0, status);
  }
});

test("the review window is counted from the latest submission", () => {
  const sub = { id: "s1", milestoneId: "m1", version: 1, attachmentId: "a", note: "", at: at(10, 10), messageId: "x" };
  const w = ws([ms({ status: "in_review", submissionIds: ["s1"] })], { submissions: [sub] });
  assert.equal(dueReminders(w, at(11), names).length, 0);
  assert.match(dueReminders(w, at(12, 12), names)[0].text, /để Thu Hà nghiệm thu bản nộp \(hết lúc 10:00 13\/10\)/);
  assert.match(dueReminders(w, at(13, 11), names)[0].text, /đã hết 3 ngày nghiệm thu/);
});

test("advancing the demo clock posts reminders into the workspace chat once", () => {
  const s0 = initialState();
  const chat = wsChatId("ws-moc");
  const before = s0.messages[chat].length;
  const s1 = reducer(s0, { type: "ADVANCE_CLOCK", ms: 3 * DAY });
  const added = s1.messages[chat].slice(before);
  assert.ok(added.length >= 1);
  assert.ok(added.every((m) => m.kind === "reminder" && m.senderId === "replyn"));
  const s2 = reducer(s1, { type: "CHECK_REMINDERS" });
  assert.equal(s2.messages[chat].length, s1.messages[chat].length, "no duplicates");
  // Real time earlier than the demo clock never moves the clock backwards.
  assert.equal(reducer(s1, { type: "CHECK_REMINDERS", now: 0 }).clock, s1.clock);
});
