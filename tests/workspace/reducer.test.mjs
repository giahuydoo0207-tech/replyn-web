// Kiểm thử reducer cho workspace thật từ Nova (thỏa thuận khóa sẵn, chat list, URL) và dữ liệu demo không đổi.
// Chạy: npm run test:workspace
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./ts-resolve.mjs", import.meta.url);
const { activeNovaWorkspace, canRecall, NOVA_ME, novaSourceChatId, novaWsId, reducer, wsChatId } = await import("../../src/lib/reducer.ts");
const { initialState, novaSessionState } = await import("../../src/lib/seed.ts");
const { nextAction } = await import("../../src/lib/protection.ts");

const WORKSPACE = "6f1c2a9e-4b7d-4c3e-9a5f-0d8b7e6c5a41";
const OTHER = "0d8b7e6c-5a41-4c3e-9a5f-6f1c2a9e4b7d";
const ACCEPTED_AT = "2026-10-05T09:35:00.000Z"; // 16:35 giờ Việt Nam
const NOW = Date.parse("2026-10-06T02:00:00.000Z");

const workspace = (overrides = {}) => ({
  workspaceId: WORKSPACE,
  projectName: "Landing page mùa thu",
  scope: "Thiết kế và code landing page.",
  deliverables: ["File Figma"],
  revisionLimit: 2,
  currency: "USDC",
  totalAmount: 2500,
  startDate: "2026-10-12",
  deadline: "2026-11-10",
  reviewPeriodDays: 3,
  milestones: [
    { title: "Thiết kế", amount: 1000, deadline: "2026-10-25" },
    { title: "Code", amount: 1500, deadline: "2026-11-10" },
  ],
  notes: "",
  acceptedAt: ACCEPTED_AT,
  businessName: "Nova Labs",
  freelancerName: "Minh Anh",
  viewerRole: "business",
  ...overrides,
});

function load(role, workspaces) {
  const viewer = { role, name: role === "business" ? "Nova Labs" : "Minh Anh" };
  return reducer(novaSessionState(viewer, NOW), {
    type: "LOAD_NOVA_WORKSPACES",
    viewer,
    workspaces: workspaces.map((w) => ({ ...w, viewerRole: role })),
  });
}

test("a real session starts without any demo people, chats or workspaces", () => {
  const s = novaSessionState({ role: "freelancer", name: "Minh Anh" }, NOW);
  assert.deepEqual(Object.keys(s.conversations), []);
  assert.deepEqual(Object.keys(s.workspaces), []);
  assert.deepEqual(s.order, []);
  assert.deepEqual(Object.keys(s.users).sort(), ["nova-me", "nova-team", "replyn"]);
  assert.equal(s.roleUser[s.role], NOVA_ME);
  assert.equal(s.clock, NOW);
});

for (const role of ["business", "freelancer"]) {
  test(`${role}: an accepted Nova proposal opens with the agreement already locked at acceptedAt`, () => {
    const s = load(role, [workspace()]);
    const ws = s.workspaces[novaWsId(WORKSPACE)];
    const acceptedAt = Date.parse(ACCEPTED_AT);
    assert.equal(ws.termsLockedAt, acceptedAt);
    assert.equal(ws.agreement.acceptedAt, acceptedAt);

    const [created, locked] = ws.evidence;
    assert.equal(created.type, "workspace_created");
    assert.equal(created.at, acceptedAt, "workspace created at acceptedAt, not a simulated clock");
    assert.equal(locked.type, "terms_locked");
    assert.equal(locked.at, acceptedAt, "agreement locked at acceptedAt, not a simulated clock");
    assert.match(locked.description, /khi Minh Anh chấp nhận đề xuất trên Nova/);
    for (const ev of ws.evidence) assert.doesNotMatch(ev.description, /chờ hai bên xác nhận/);

    const chat = s.messages[wsChatId(ws.id)];
    assert.ok(chat.every((m) => m.at === acceptedAt), "opening messages use acceptedAt");
    assert.ok(chat.some((m) => m.text === "Thỏa thuận đã khóa khi Minh Anh chấp nhận đề xuất trên Nova"));

    // Không còn bước "xác nhận thỏa thuận": việc cần làm chuyển sang ký quỹ / chờ ký quỹ.
    assert.doesNotMatch(nextAction(ws, NOVA_ME).text, /Xác nhận thỏa thuận/);
    assert.equal(reducer(s, { type: "LOCK_TERMS", wsId: ws.id }), s, "locking again is a no-op");
    const funded = reducer(s, { type: "FUND", wsId: ws.id, milestoneId: ws.milestones[0].id });
    assert.equal(funded.workspaces[ws.id].milestones[0].status, "funded_sim", "escrow (simulated) is available right away");
  });

  test(`${role}: each real workspace has exactly one chat list entry that leads into the workspace`, () => {
    const s = load(role, [workspace(), workspace({ workspaceId: OTHER, acceptedAt: "2026-10-06T01:00:00.000Z" })]);
    const sources = s.order.filter((id) => s.conversations[id].kind === "nova");
    // mới chấp nhận gần nhất lên đầu
    assert.deepEqual(sources, [novaSourceChatId(OTHER), novaSourceChatId(WORKSPACE)]);
    for (const id of [WORKSPACE, OTHER]) {
      const source = s.conversations[novaSourceChatId(id)];
      const wsChat = s.conversations[wsChatId(novaWsId(id))];
      assert.equal(source.linkedWorkspaceChatId, wsChat.id);
      // Mục workspace được ChatList gộp vào mục hội thoại nguồn (ẩn vì có sourceNovaChatId).
      assert.equal(wsChat.sourceNovaChatId, source.id);
      assert.ok(source.memberIds.includes(NOVA_ME));
    }
    // Nạp lại (ví dụ lấy thêm một workspace) không nhân đôi mục.
    const again = reducer(s, { type: "LOAD_NOVA_WORKSPACES", viewer: { role, name: "x" }, workspaces: [{ ...workspace(), viewerRole: role }] });
    assert.equal(again.order.filter((id) => id === novaSourceChatId(WORKSPACE)).length, 1);
  });

  test(`${role}: opening the conversation or the workspace maps to /workspace/{id}`, () => {
    const s = load(role, [workspace()]);
    const viaSource = reducer(s, { type: "SELECT_CHAT", chatId: novaSourceChatId(WORKSPACE) });
    assert.equal(activeNovaWorkspace(viaSource), WORKSPACE);
    const viaWorkspace = reducer(s, { type: "SELECT_CHAT", chatId: wsChatId(novaWsId(WORKSPACE)) });
    assert.equal(activeNovaWorkspace(viaWorkspace), WORKSPACE);
    assert.equal(activeNovaWorkspace(reducer(s, { type: "SELECT_CHAT", chatId: null })), null);
  });
}

test("the Nova Business return URL from the server is kept on the agreement", () => {
  const url = `https://business.nova.test/business/messages?thread=${OTHER}`;
  const s = load("business", [workspace({ novaReturnUrl: url })]);
  assert.equal(s.workspaces[novaWsId(WORKSPACE)].agreement.novaReturnUrl, url);
  const without = load("business", [workspace()]);
  assert.equal(without.workspaces[novaWsId(WORKSPACE)].agreement.novaReturnUrl, undefined);
});

test("demo data keeps its own flow: the seed agreement still needs both parties to confirm", () => {
  const s = initialState();
  const moc = s.workspaces["ws-moc"];
  assert.equal(moc.termsLockedAt, null);
  assert.equal(moc.agreement, undefined);
  assert.equal(nextAction(moc, "u-ha").text, "Xác nhận thỏa thuận để bắt đầu");
  assert.equal(activeNovaWorkspace(s), null, "demo chats never change the URL");
  const locked = reducer(s, { type: "LOCK_TERMS", wsId: "ws-moc" });
  assert.equal(locked.workspaces["ws-moc"].termsLockedAt, s.clock + 4 * 60 * 1000);
  assert.ok(s.order.includes("group-hcm"));
});

test("recalling hides a message in chat but keeps its content for the archive", () => {
  const s0 = load("business", [workspace()]);
  const chatId = wsChatId(novaWsId(WORKSPACE));
  const sent = reducer(s0, { type: "SEND_TEXT", chatId, text: "Giá cuối 2.300 USDC" });
  const mine = sent.messages[chatId].at(-1);
  assert.equal(canRecall(sent, mine), true);

  const recalled = reducer(sent, { type: "RECALL_MESSAGE", chatId, messageId: mine.id });
  const kept = recalled.messages[chatId].find((m) => m.id === mine.id);
  assert.equal(kept.text, "Giá cuối 2.300 USDC", "the archive keeps the original text");
  assert.ok(kept.recalledAt >= mine.at);
  assert.equal(recalled.messages[chatId].length, sent.messages[chatId].length, "nothing is deleted");
  assert.equal(canRecall(recalled, kept), false);
  // A second recall changes nothing.
  assert.equal(reducer(recalled, { type: "RECALL_MESSAGE", chatId, messageId: mine.id }), recalled);
});

test("only the sender can recall, and only their own text or file in a workspace chat", () => {
  const s0 = load("business", [workspace()]);
  const chatId = wsChatId(novaWsId(WORKSPACE));
  const theirs = reducer(s0, { type: "SEND_TEXT", chatId, text: "Tin của bên kia", senderId: "someone-else" });
  const other = theirs.messages[chatId].at(-1);
  assert.equal(canRecall(theirs, other), false);
  assert.equal(reducer(theirs, { type: "RECALL_MESSAGE", chatId, messageId: other.id }), theirs);
  // System notices (agreement locked, milestones created) can never be recalled.
  for (const notice of s0.messages[chatId]) assert.equal(canRecall(s0, notice), false);
});

test("mark as unread keeps at least one unread message on the conversation", () => {
  const s0 = load("freelancer", [workspace()]);
  const chatId = wsChatId(novaWsId(WORKSPACE));
  const read = reducer(s0, { type: "SELECT_CHAT", chatId });
  assert.equal(read.conversations[chatId].unread, 0);
  assert.equal(reducer(read, { type: "MARK_UNREAD", chatId }).conversations[chatId].unread, 1);
});
