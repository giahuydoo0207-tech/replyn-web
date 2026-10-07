// Kiểm thử gói hồ sơ tranh chấp: gom đủ phần, giữ tin đã thu hồi trong workspace, PDF có kèm dữ liệu gốc.
// Chạy: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

register("./ts-resolve.mjs", import.meta.url);
const { reducer, wsChatId } = await import("../../src/lib/reducer.ts");
const { initialState } = await import("../../src/lib/seed.ts");
const { buildDisputePack, packSummary } = await import("../../src/lib/disputePack.ts");
const { buildDisputePackPdf, PACK_ATTACHMENT } = await import("../../src/lib/disputePackPdf.ts");
const { PDFDocument, PDFName, PDFDict, PDFArray } = await import("pdf-lib");

const fonts = {
  regular: readFileSync(new URL("../../public/fonts/BeVietnamPro-Regular.ttf", import.meta.url)),
  semibold: readFileSync(new URL("../../public/fonts/BeVietnamPro-SemiBold.ttf", import.meta.url)),
};

test("the pack gathers agreement, milestones, submissions, disputes, events and messages", () => {
  const s = initialState();
  const pack = buildDisputePack(s, "ws-tramay", Date.parse("2026-10-07T08:00:00Z"));
  const sum = packSummary(pack);
  assert.equal(pack.format, "replyn-dispute-pack/1");
  assert.equal(pack.workspace.title, "Bộ nhận diện Trà Mây");
  assert.ok(sum.disputes >= 1, "the open support request is included");
  assert.equal(sum.milestones, s.workspaces["ws-tramay"].milestones.length);
  assert.equal(sum.submissions, s.workspaces["ws-tramay"].submissions.length);
  assert.equal(sum.events, s.workspaces["ws-tramay"].evidence.length);
  assert.ok(pack.messages.every((m) => m.sender && m.at), "system notices are left out");
  assert.equal(buildDisputePack(s, "missing"), null);
});

test("a message recalled in the workspace stays in the pack with its time of recall", () => {
  const s0 = initialState();
  const chatId = wsChatId("ws-lotus");
  const sent = reducer(s0, { type: "SEND_TEXT", chatId, text: "Mình giảm còn 2.300 USDC nhé" });
  const id = sent.messages[chatId].at(-1).id;
  const recalled = reducer(sent, { type: "RECALL_MESSAGE", chatId, messageId: id });
  const msg = buildDisputePack(recalled, "ws-lotus").messages.find((m) => m.text === "Mình giảm còn 2.300 USDC nhé");
  assert.ok(msg);
  assert.ok(msg.recalledAt);
});

test("the readable PDF carries the original pack", async () => {
  const pack = buildDisputePack(initialState(), "ws-tramay", Date.parse("2026-10-07T08:00:00Z"));
  const bytes = await buildDisputePackPdf(pack, fonts);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), "Hồ sơ hỗ trợ: Bộ nhận diện Trà Mây");
  const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
  assert.equal(names.lookup(0).decodeText(), PACK_ATTACHMENT);
});
