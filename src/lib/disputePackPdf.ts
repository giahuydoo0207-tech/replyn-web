/**
 * Bản dễ đọc của gói hồ sơ tranh chấp: một file PDF cùng phong cách bản thỏa thuận, có kèm dữ liệu gốc (JSON) bên
 * trong để đội ngũ hỗ trợ đối chiếu. Font truyền vào dạng byte, không phụ thuộc trình duyệt hay Node.
 */
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { DisputePack } from "./disputePack";
import { C, PAGE, wrapText, type PdfFonts } from "./seal/pdf";
import type { ChangeOp } from "./types";

export const PACK_ATTACHMENT = "ho-so-replyn.json";

const M = 56;
const W = PAGE[0] - M * 2;
const TOP = PAGE[1] - 40;
const FOOT = 52;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Giờ Việt Nam, không phụ thuộc múi giờ máy. */
const when = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "";
  const t = new Date(ms + 7 * 3600_000);
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())} ${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
};
const usd = (n: number, c = "USDC") => `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${c}`;
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const opText = (o: ChangeOp) =>
  o.op === "add"
    ? `Thêm "${o.after.title}" · ${usd(o.after.amount)} · hạn ${o.after.deadline}`
    : o.op === "remove"
      ? `Bỏ "${o.before.title}" · ${usd(o.before.amount)}`
      : [
          `"${o.before.title}":`,
          o.before.title !== o.after.title ? `tên → "${o.after.title}"` : "",
          o.before.amount !== o.after.amount ? `số tiền ${usd(o.before.amount)} → ${usd(o.after.amount)}` : "",
          o.before.deadline !== o.after.deadline ? `hạn ${o.before.deadline} → ${o.after.deadline}` : "",
        ]
          .filter(Boolean)
          .join(" ");
const STATUS = { pending: "Đang chờ", accepted: "Đã đồng ý", declined: "Đã từ chối", withdrawn: "Đã rút lại" } as const;

export async function buildDisputePackPdf(pack: DisputePack, fonts: PdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fonts.regular, { subset: true });
  const semi = await doc.embedFont(fonts.semibold, { subset: true });
  const created = new Date(pack.generatedAt);
  const ref = pack.workspace.agreementNo ?? pack.workspace.id.slice(0, 12);

  doc.setTitle(`Hồ sơ hỗ trợ: ${pack.workspace.title}`);
  doc.setSubject("Hồ sơ dự án gửi đội ngũ hỗ trợ Replyn");
  doc.setAuthor("Replyn");
  doc.setCreator("Replyn");
  doc.setProducer("Replyn");
  doc.setLanguage("vi");
  doc.setCreationDate(created);
  doc.setModificationDate(created);
  await doc.attach(new TextEncoder().encode(JSON.stringify(pack, null, 2)), PACK_ATTACHMENT, {
    mimeType: "application/json",
    description: "Dữ liệu gốc của hồ sơ",
    creationDate: created,
    modificationDate: created,
  });

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = doc.addPage(PAGE);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: C.paper });
    page.drawText("REPLYN", { x: M, y: TOP + 8, size: 9.5, font: semi, color: C.ink });
    const meta = `Hồ sơ hỗ trợ  ·  ${ref}`;
    page.drawText(meta, { x: M + W - reg.widthOfTextAtSize(meta, 8.5), y: TOP + 8, size: 8.5, font: reg, color: C.muted });
    page.drawLine({ start: { x: M, y: TOP }, end: { x: M + W, y: TOP }, thickness: 0.8, color: C.ink });
    y = TOP - 28;
  };
  const ensure = (h: number) => {
    if (y - h < FOOT + 24) newPage();
  };
  const draw = (s: string, x: number, yy: number, sz: number, font: PDFFont, color: RGB = C.ink) =>
    page.drawText(s, { x, y: yy, size: sz, font, color });
  const lines = (s: string, x: number, width: number, sz = 9.5, font = reg, color: RGB = C.ink, lead = 1.45) => {
    for (const line of wrapText(s, font, sz, width)) {
      ensure(sz * lead);
      y -= sz * lead;
      draw(line, x, y, sz, font, color);
    }
  };
  let n = 0;
  const section = (title: string, count?: number) => {
    ensure(60);
    y -= 30;
    n += 1;
    draw(`${n}.`, M, y, 11, semi, C.accent);
    draw(title, M + 22, y, 11, semi);
    if (count !== undefined) {
      const c = String(count);
      draw(c, M + W - reg.widthOfTextAtSize(c, 9), y, 9, reg, C.muted);
    }
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: C.line });
  };
  const empty = (s: string) => lines(s, M + 22, W - 22, 9.5, reg, C.muted);
  /** Một mục có cột thời gian bên trái. */
  const entry = (time: string, head: string, body?: string, tag?: string) => {
    const x = M + 96;
    const w = W - 96;
    ensure(30);
    y -= 16;
    draw(time, M, y, 8.5, reg, C.muted);
    const headLines = wrapText(head, semi, 9.5, w - (tag ? semi.widthOfTextAtSize(tag, 8) + 12 : 0));
    headLines.forEach((l, i) => {
      if (i > 0) {
        ensure(14);
        y -= 14;
      }
      draw(l, x, y, 9.5, semi);
    });
    if (tag) draw(tag, M + W - semi.widthOfTextAtSize(tag, 8), y, 8, semi, C.accent);
    if (body) lines(body, x, w, 9.5, reg, C.ink2);
    y -= 4;
  };

  /* ----- Trang bìa tóm tắt ----- */
  newPage();
  draw("HỒ SƠ HỖ TRỢ", M, y, 8.5, semi, C.accent);
  y -= 8;
  for (const l of wrapText(pack.workspace.title, semi, 24, W)) {
    y -= 29;
    draw(l, M, y, 24, semi);
  }
  y -= 22;
  draw(`Giữa ${pack.workspace.client} (bên thuê) và ${pack.workspace.contractor} (bên thực hiện)`, M, y, 10.5, reg, C.ink2);
  y -= 24;
  const meta: [string, string][] = [
    ["Số thỏa thuận", pack.workspace.agreementNo ?? "Không có"],
    ["Phiên bản hiện hành", String(pack.agreement.version)],
    ["Tạo lúc", when(pack.generatedAt)],
    ["Gửi tới", "Đội ngũ hỗ trợ Replyn"],
  ];
  meta.forEach(([k, v], i) => {
    draw(k, M + (i * W) / 4, y, 8, reg, C.muted);
    draw(v, M + (i * W) / 4, y - 14, 10, semi);
  });
  y -= 30;

  const bandH = 56;
  y -= 10;
  page.drawRectangle({ x: M, y: y - bandH, width: W, height: bandH, color: C.panel });
  const stats: [string, string][] = [
    ["Yêu cầu hỗ trợ", String(pack.disputes.length)],
    ["Giai đoạn", String(pack.milestones.length)],
    ["Sản phẩm đã nộp", String(pack.submissions.length)],
    ["Sự kiện", String(pack.events.length)],
    ["Tin nhắn", String(pack.messages.length)],
  ];
  stats.forEach(([k, v], i) => {
    const x = M + 14 + (i * W) / stats.length;
    draw(k, x, y - 20, 8, reg, C.muted);
    draw(v, x, y - 38, 13, semi, i === 0 ? C.accent : C.ink);
  });
  y -= bandH + 12;
  lines(
    "Hồ sơ được Replyn dựng tự động từ dữ liệu dự án. Hai bên đều xem được hồ sơ gồm những gì và không ai sửa được nội dung. Tin nhắn đã thu hồi trong workspace vẫn có trong hồ sơ, đúng như Lưu trữ dự án.",
    M,
    W,
    9,
    reg,
    C.muted,
  );

  /* ----- Các phần ----- */
  section("Yêu cầu hỗ trợ", pack.disputes.length);
  if (!pack.disputes.length) empty("Chưa có yêu cầu hỗ trợ nào.");
  pack.disputes.forEach((d) => entry(when(d.at), `${d.milestone} · ${d.openedBy} mở`, `“${d.reason}”`, d.status));

  section("Thỏa thuận và các phiên bản", pack.agreement.changes.length);
  const o = pack.agreement.original;
  if (o) {
    entry(when(o.acceptedAt), `Phiên bản 1 · chốt trên Nova · ${usd(o.totalAmount, o.currency)}`, o.scope);
    if (o.deliverables.length) lines(`Bàn giao: ${o.deliverables.join("; ")}`, M + 96, W - 96, 9.5, reg, C.ink2);
    if (o.startDate || o.deadline) lines(`Thời gian: ${o.startDate ?? "?"} đến ${o.deadline ?? "?"}`, M + 96, W - 96, 9.5, reg, C.ink2);
  } else {
    empty("Thỏa thuận được hai bên xác nhận trên Replyn (không có bản gốc từ Nova).");
  }
  pack.agreement.changes.forEach((c) => {
    entry(when(c.at), `Đề xuất của ${c.proposedBy} · phiên bản ${c.fromVersion} → ${c.fromVersion + 1}`, `Lý do: “${c.reason}”`, STATUS[c.status]);
    c.ops.forEach((op) => lines(`• ${opText(op)}`, M + 96, W - 96, 9, reg, C.ink2));
    if (c.respondedBy) lines(`${c.respondedBy} trả lời lúc ${when(c.respondedAt)}${c.responseNote ? `: “${c.responseNote}”` : ""}`, M + 96, W - 96, 9, reg, C.muted);
  });

  section("Giai đoạn hiện hành", pack.milestones.length);
  pack.milestones.forEach((m) => {
    ensure(20);
    y -= 17;
    draw(String(m.index), M, y, 9.5, reg, C.muted);
    const t = wrapText(m.title, reg, 9.5, W - 300)[0];
    draw(t, M + 22, y, 9.5, reg);
    draw(m.deadline, M + W - 270, y, 9.5, reg, C.ink2);
    draw(m.status, M + W - 190, y, 9, reg, C.ink2);
    const amt = usd(m.amount);
    draw(amt, M + W - semi.widthOfTextAtSize(amt, 9.5), y, 9.5, semi);
  });

  section("Sản phẩm đã nộp", pack.submissions.length);
  if (!pack.submissions.length) empty("Chưa có sản phẩm nào được nộp.");
  pack.submissions.forEach((s) => {
    entry(when(s.at), `${s.milestone} · bản ${s.version}`, s.note || undefined);
    if (s.file) {
      lines(`${s.file.name} · ${size(s.file.size)}`, M + 96, W - 96, 9, reg, C.ink2);
      lines(`SHA-256 ${s.file.sha256}`, M + 96, W - 96, 8, reg, C.muted);
    }
  });

  section("Nhật ký dự án", pack.events.length);
  pack.events.forEach((e) => entry(when(e.at), e.title, e.description));

  section("Lưu trữ tin nhắn", pack.messages.length);
  if (!pack.messages.length) empty("Chưa có tin nhắn nào.");
  let chapter: string | null = null;
  pack.messages.forEach((m) => {
    if (m.chapter !== chapter) {
      chapter = m.chapter;
      ensure(30);
      y -= 20;
      draw(m.chapter === "before" ? "Trao đổi trước khi chốt" : "Trong workspace", M, y, 9, semi, C.muted);
    }
    const tag = m.recalledAt ? `Đã thu hồi ${when(m.recalledAt).slice(0, 5)}` : m.pinned ? "Đã ghim" : undefined;
    const body = [m.text, m.file ? `Tệp: ${m.file.name} · ${size(m.file.size)}` : null].filter(Boolean).join("\n");
    entry(when(m.at), m.sender, body || undefined, tag);
  });

  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: FOOT }, end: { x: M + W, y: FOOT }, thickness: 0.5, color: C.line });
    p.drawText("Có kèm dữ liệu gốc (JSON) trong file PDF này.", { x: M, y: FOOT - 14, size: 7.5, font: reg, color: C.muted });
    const label = `Trang ${i + 1}/${pages.length}`;
    p.drawText(label, { x: M + W - reg.widthOfTextAtSize(label, 7.5), y: FOOT - 14, size: 7.5, font: reg, color: C.muted });
  });

  return doc.save();
}
