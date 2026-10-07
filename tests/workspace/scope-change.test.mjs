// Kiểm thử đề xuất đổi phạm vi: một bên đề xuất, bên kia đồng ý thì lên phiên bản mới; luật chặn đề xuất sai.
// Chạy: npm test
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./ts-resolve.mjs", import.meta.url);
const { reducer, wsChatId } = await import("../../src/lib/reducer.ts");
const { initialState } = await import("../../src/lib/seed.ts");
const { applyOps, pendingChange, termsOf, totals } = await import("../../src/lib/scopeChange.ts");

const WS = "ws-moc"; // Thu Hà (bên thuê) và Minh Khoa (bên thực hiện) trong dữ liệu mẫu
const asFreelancer = (s) => reducer(s, { type: "SET_ROLE", role: "freelancer" });
const asBusiness = (s) => reducer(s, { type: "SET_ROLE", role: "business" });
/** Dữ liệu mẫu: thỏa thuận Mộc Coffee chưa khóa, nên khóa trước rồi mới đề xuất đổi. */
const locked = () => asBusiness(reducer(initialState(), { type: "LOCK_TERMS", wsId: WS }));

function propose(s, ops, reason = "Khách thêm trang đặt bàn") {
  return reducer(s, { type: "PROPOSE_SCOPE_CHANGE", wsId: WS, reason, ops });
}

const raise = (s, amount = 300) => {
  const m = s.workspaces[WS].milestones.at(-1);
  return [{ op: "edit", milestoneId: m.id, before: termsOf(m), after: { ...termsOf(m), amount: m.amount + amount } }];
};

test("a proposal posts a card in the chat and waits for the other side", () => {
  const s0 = locked();
  const s1 = propose(s0, raise(s0));
  const c = pendingChange(s1.workspaces[WS]);
  assert.ok(c);
  assert.equal(c.proposedBy, "u-ha");
  assert.equal(c.fromVersion, 1);
  const card = s1.messages[wsChatId(WS)].at(-1);
  assert.equal(card.kind, "change");
  assert.equal(card.refs.changeId, c.id);
  // The proposer cannot accept their own proposal.
  assert.equal(reducer(s1, { type: "RESPOND_SCOPE_CHANGE", wsId: WS, changeId: c.id, accept: true }), s1);
  // Only one proposal at a time.
  assert.equal(propose(s1, raise(s1, 50)), s1);
});

test("accepting applies the change and bumps the version", () => {
  const s0 = locked();
  const before = s0.workspaces[WS].milestones;
  const add = { op: "add", after: { title: "Trang đặt bàn", amount: 300, deadline: "30/10/2026" } };
  const s1 = propose(s0, [...raise(s0, 200), add]);
  const c = pendingChange(s1.workspaces[WS]);
  const s2 = reducer(asFreelancer(s1), { type: "RESPOND_SCOPE_CHANGE", wsId: WS, changeId: c.id, accept: true });
  const w = s2.workspaces[WS];
  assert.equal(w.version, 2);
  assert.equal(w.changes[0].totalBefore, before.reduce((sum, m) => sum + m.amount, 0), "the card keeps the total at proposal time");
  assert.equal(totals(w.milestones, w.changes[0].ops, w.changes[0].totalBefore).after, w.milestones.reduce((sum, m) => sum + m.amount, 0));
  assert.equal(w.changes[0].status, "accepted");
  assert.equal(w.changes[0].respondedBy, "u-khoa");
  assert.equal(w.milestones.length, before.length + 1);
  assert.equal(w.milestones.at(-2).amount, before.at(-1).amount + 200);
  assert.equal(w.milestones.at(-1).title, "Trang đặt bàn");
  assert.equal(w.milestones.at(-1).status, "awaiting_funding");
  assert.equal(new Set(w.milestones.map((m) => m.id)).size, w.milestones.length, "new milestone ids are unique");
  assert.equal(w.evidence.at(-1).type, "scope_changed");
  assert.match(s2.messages[wsChatId(WS)].at(-1).text, /phiên bản 2/);
  assert.equal(pendingChange(w), undefined);
});

test("declining or withdrawing leaves the agreement untouched", () => {
  const s0 = locked();
  const s1 = propose(s0, raise(s0));
  const c = pendingChange(s1.workspaces[WS]);
  const declined = reducer(asFreelancer(s1), { type: "RESPOND_SCOPE_CHANGE", wsId: WS, changeId: c.id, accept: false, note: "Giữ giá cũ" });
  assert.equal(declined.workspaces[WS].changes[0].status, "declined");
  assert.equal(declined.workspaces[WS].changes[0].responseNote, "Giữ giá cũ");
  assert.deepEqual(declined.workspaces[WS].milestones, s0.workspaces[WS].milestones);
  assert.equal(declined.workspaces[WS].version ?? 1, 1);

  const withdrawn = reducer(s1, { type: "WITHDRAW_SCOPE_CHANGE", wsId: WS, changeId: c.id });
  assert.equal(withdrawn.workspaces[WS].changes[0].status, "withdrawn");
  // The other side cannot withdraw someone else's proposal.
  assert.equal(reducer(asFreelancer(s1), { type: "WITHDRAW_SCOPE_CHANGE", wsId: WS, changeId: c.id }).workspaces[WS].changes[0].status, "pending");
});

test("no proposals before the agreement is locked", () => {
  const s0 = asBusiness(initialState());
  assert.equal(propose(s0, raise(s0)), s0);
});

test("released milestones cannot be edited and funded ones cannot be removed", () => {
  const s = initialState();
  const lotus = s.workspaces["ws-lotus"].milestones; // lt-1 đã giải ngân, lt-2 đã ký quỹ và đang nộp
  const id = (i) => i;
  assert.equal(applyOps(lotus, [{ op: "edit", milestoneId: "lt-1", before: termsOf(lotus[0]), after: { ...termsOf(lotus[0]), amount: 1 } }], id), null);
  assert.equal(applyOps(lotus, [{ op: "remove", milestoneId: "lt-2", before: termsOf(lotus[1]) }], id), null);
  assert.equal(applyOps(lotus, [{ op: "add", after: { title: "", amount: 100, deadline: "30/10/2026" } }], id), null);
  const ok = applyOps(lotus, [{ op: "edit", milestoneId: "lt-2", before: termsOf(lotus[1]), after: { ...termsOf(lotus[1]), deadline: "20/10/2026" } }], id);
  assert.equal(ok[1].deadline, "20/10/2026");
  assert.equal(ok[1].status, lotus[1].status, "editing terms keeps the milestone's progress");
});

test("totals show the change in overall value", () => {
  const ms = [{ id: "a", amount: 1000 }, { id: "b", amount: 1500 }];
  const t = totals(ms, [
    { op: "edit", milestoneId: "b", before: { title: "B", amount: 1500, deadline: "18/10/2026" }, after: { title: "B", amount: 1800, deadline: "18/10/2026" } },
    { op: "add", after: { title: "C", amount: 300, deadline: "30/10/2026" } },
    { op: "remove", milestoneId: "a", before: { title: "A", amount: 1000, deadline: "15/10/2026" } },
  ]);
  assert.deepEqual(t, { before: 2500, after: 2100, delta: -400 });
});
