// Kiểm thử reducer: mở dự án từ chat trực tiếp, thu hồi, ghim, lưu trữ, và dữ liệu demo không đổi.
// Chạy: npm run test:workspace
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./ts-resolve.mjs", import.meta.url);
const { canPin, canRecall, me, pinnedMessages, reducer, wsChatId } = await import("../../src/lib/reducer.ts");
const { initialState } = await import("../../src/lib/seed.ts");
const { nextAction } = await import("../../src/lib/protection.ts");
const { extractLinks, matchesFilter, splitLinks } = await import("../../src/lib/archive.ts");

const WORKSPACE = "ws-test";
const chatId = wsChatId(WORKSPACE);

/** Doanh nghiệp (Hà) mở dự án với Khoa ngay trong chat trực tiếp, hai bên xác nhận; xem từ phía `role`. */
function load(role) {
  const s0 = { ...initialState(), role };
  const opened = reducer(s0, {
    type: "CREATE_WORKSPACE",
    wsId: WORKSPACE,
    title: "Landing page mùa thu",
    businessId: "u-ha",
    freelancerId: "u-khoa",
    feeTier: "BASIC",
    draft: [
      { id: "t-1", title: "Thiết kế", amount: 1000, deadline: "25/10/2026", criteria: [] },
      { id: "t-2", title: "Code", amount: 1500, deadline: "10/11/2026", criteria: [] },
    ],
  });
  return reducer(opened, { type: "LOCK_TERMS", wsId: WORKSPACE });
}

test("a project opened from a direct chat links both ways and starts unconfirmed", () => {
  const s0 = initialState();
  const opened = reducer(s0, {
    type: "CREATE_WORKSPACE",
    wsId: WORKSPACE,
    title: "Landing page mùa thu",
    businessId: "u-ha",
    freelancerId: "u-quan",
    feeTier: "BASIC",
    fromChat: "dm-quan",
    draft: [{ id: "t-1", title: "Thiết kế", amount: 1000, deadline: "25/10/2026", criteria: [] }],
  });
  const ws = opened.workspaces[WORKSPACE];
  assert.equal(ws.termsLockedAt, null);
  assert.equal(opened.conversations[chatId].sourceChatId, "dm-quan");
  assert.equal(opened.conversations["dm-quan"].linkedWorkspaceChatId, chatId);
  assert.match(opened.messages[chatId][0].text, /được mở từ cuộc trò chuyện với/);
  assert.equal(nextAction(ws, "u-ha").text, "Xác nhận thỏa thuận để bắt đầu");
});

test("demo data keeps its own flow: the seed agreement still needs both parties to confirm", () => {
  const s = initialState();
  const moc = s.workspaces["ws-moc"];
  assert.equal(moc.termsLockedAt, null);
  assert.equal(nextAction(moc, "u-ha").text, "Xác nhận thỏa thuận để bắt đầu");
  const locked = reducer(s, { type: "LOCK_TERMS", wsId: "ws-moc" });
  assert.equal(locked.workspaces["ws-moc"].termsLockedAt, s.clock + 4 * 60 * 1000);
  assert.ok(s.order.includes("group-hcm"));
});

test("recalling hides a message in chat but keeps its content for the archive", () => {
  const s0 = load("business");
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
  const s0 = load("business");
  const theirs = reducer(s0, { type: "SEND_TEXT", chatId, text: "Tin của bên kia", senderId: "someone-else" });
  const other = theirs.messages[chatId].at(-1);
  assert.equal(canRecall(theirs, other), false);
  assert.equal(reducer(theirs, { type: "RECALL_MESSAGE", chatId, messageId: other.id }), theirs);
  // System notices (agreement locked, milestones created) can never be recalled.
  for (const notice of s0.messages[chatId]) assert.equal(canRecall(s0, notice), false);
});

test("mark as unread keeps at least one unread message on the conversation", () => {
  const s0 = load("freelancer");
  const read = reducer(s0, { type: "SELECT_CHAT", chatId });
  assert.equal(read.conversations[chatId].unread, 0);
  assert.equal(reducer(read, { type: "MARK_UNREAD", chatId }).conversations[chatId].unread, 1);
});

test("either side can pin a workspace message, pressing again unpins it", () => {
  const s0 = load("business");
  const sent = reducer(s0, { type: "SEND_TEXT", chatId, text: "Giao bản nháp trước thứ 6", senderId: "someone-else" });
  const theirs = sent.messages[chatId].at(-1);
  assert.equal(canPin(sent, theirs), true);

  const pinned = reducer(sent, { type: "TOGGLE_MESSAGE_PIN", chatId, messageId: theirs.id });
  const kept = pinned.messages[chatId].find((m) => m.id === theirs.id);
  assert.ok(kept.pinnedAt);
  assert.equal(kept.pinnedBy, me(pinned));
  assert.equal(kept.text, theirs.text, "pinning never changes the message");
  assert.deepEqual(pinnedMessages(pinned, chatId).map((m) => m.id), [theirs.id]);

  const unpinned = reducer(pinned, { type: "TOGGLE_MESSAGE_PIN", chatId, messageId: theirs.id });
  assert.equal(unpinned.messages[chatId].find((m) => m.id === theirs.id).pinnedAt, undefined);
  assert.equal(pinnedMessages(unpinned, chatId).length, 0);
  // System notices cannot be pinned.
  for (const notice of s0.messages[chatId]) assert.equal(canPin(s0, notice), false);
});

test("recalling a pinned message removes it from the pins but the archive keeps the text", () => {
  const s0 = load("business");
  const sent = reducer(s0, { type: "SEND_TEXT", chatId, text: "Chốt màu chủ đạo xanh rêu" });
  const mine = sent.messages[chatId].at(-1);
  const pinned = reducer(sent, { type: "TOGGLE_MESSAGE_PIN", chatId, messageId: mine.id });
  const recalled = reducer(pinned, { type: "RECALL_MESSAGE", chatId, messageId: mine.id });
  const kept = recalled.messages[chatId].find((m) => m.id === mine.id);
  assert.equal(kept.text, "Chốt màu chủ đạo xanh rêu");
  assert.equal(kept.pinnedAt, undefined);
  assert.equal(pinnedMessages(recalled, chatId).length, 0);
  assert.equal(canPin(recalled, kept), false);
});

test("archive filters sort messages into files, links, media, pinned and recalled", () => {
  const text = (t, extra = {}) => ({ id: "m", chatId: "c", senderId: "u", at: 1, kind: "text", text: t, ...extra });
  const file = (name, kind = "file") => [{ ...text(undefined), kind: "file" }, { id: "a", name, size: 1, hash: "x", uploadedBy: "u", at: 1, kind }];
  assert.equal(matchesFilter("links", text("Xem bản nháp: https://figma.com/file/abc, góp ý nhé."), undefined), true);
  assert.equal(matchesFilter("links", text("Không có liên kết"), undefined), false);
  assert.equal(matchesFilter("files", ...file("hop-dong.pdf")), true);
  assert.equal(matchesFilter("media", ...file("hop-dong.pdf")), false);
  assert.equal(matchesFilter("media", ...file("banner.png", "image")), true);
  assert.equal(matchesFilter("media", ...file("demo.mp4")), true);
  assert.equal(matchesFilter("files", ...file("demo.mp4")), false);
  assert.equal(matchesFilter("pinned", text("a", { pinnedAt: 2 }), undefined), true);
  assert.equal(matchesFilter("pinned", text("a", { pinnedAt: 2, recalledAt: 3 }), undefined), false);
  assert.equal(matchesFilter("recalled", text("a", { recalledAt: 3 }), undefined), true);
});

test("links are extracted without trailing punctuation and only for http(s)", () => {
  assert.deepEqual(extractLinks("Xem https://figma.com/file/abc, rồi (https://replyn.app/x)."), ["https://figma.com/file/abc", "https://replyn.app/x"]);
  assert.deepEqual(extractLinks("javascript:alert(1) ftp://a.b"), []);
  const parts = splitLinks("Mở https://figma.com/a nhé");
  assert.deepEqual(parts, [{ text: "Mở " }, { text: "https://figma.com/a", href: "https://figma.com/a" }, { text: " nhé" }]);
});

test("recall in a group removes the message without a trace, unlike a workspace", () => {
  const s0 = initialState();
  const chatId = "group-hcm";
  const sent = reducer(s0, { type: "SEND_TEXT", chatId, text: "Nhầm nhóm, số tài khoản của mình là ..." });
  const mine = sent.messages[chatId].at(-1);
  assert.equal(canRecall(sent, mine), true);
  const recalled = reducer(sent, { type: "RECALL_MESSAGE", chatId, messageId: mine.id });
  assert.equal(recalled.messages[chatId].find((m) => m.id === mine.id), undefined, "no recalled line is left behind");
  assert.equal(recalled.messages[chatId].length, s0.messages[chatId].length);
  assert.equal(JSON.stringify(recalled.messages[chatId]).includes("số tài khoản"), false);
});
