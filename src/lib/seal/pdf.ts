/**
 * Bản thỏa thuận dạng PDF cho người đọc, tiếng Việt hoặc tiếng Anh. Bố cục theo lối hợp đồng dịch vụ: điều khoản đánh
 * số, khối xác nhận của hai bên, rồi một trang "Chứng nhận niêm phong" (giống chứng nhận hoàn tất của các dịch vụ ký
 * điện tử) với nhật ký sự kiện và cách tự kiểm tra.
 *
 * Chỉ nhãn được dịch; nội dung do hai bên nhập (phạm vi, tên giai đoạn...) giữ nguyên văn vì đó là bản đã niêm phong.
 * Dữ liệu gốc (JSON) được đính kèm trong PDF để trang Kiểm chứng đọc thẳng file PDF.
 * Không phụ thuộc trình duyệt hay Node: font được truyền vào dưới dạng byte.
 */
import fontkit from "@pdf-lib/fontkit";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import qrcode from "qrcode-generator";
import type { AgreementFile } from "./agreement";

export const AGREEMENT_ATTACHMENT = "thoa-thuan-replyn.json";

export type PdfLocale = "vi" | "en";

export interface PdfFonts {
  regular: Uint8Array | ArrayBuffer;
  semibold: Uint8Array | ArrayBuffer;
}

export interface PdfOptions {
  locale?: PdfLocale;
  /** ISO thời điểm niêm phong trên chuỗi, nếu có. */
  sealedAt: string | null;
  /** Trang kiểm chứng (mã QR trỏ tới đây). */
  verifyUrl: string;
  /** Phiên bản thỏa thuận (tăng khi hai bên đồng ý đổi phạm vi). */
  version?: number;
  /** Giờ tạo file; truyền vào để kết quả lặp lại được khi kiểm thử. */
  now?: Date;
}

/* ---------- ngôn ngữ ---------- */

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: string | null) => (d ? /^(\d{4})-(\d{2})-(\d{2})/.exec(d) : null);
const vnTime = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600_000) : null; // giờ Việt Nam, không phụ thuộc máy
};

const T = {
  vi: {
    docType: "THỎA THUẬN DỊCH VỤ",
    docNo: "Số thỏa thuận",
    version: "Phiên bản",
    effective: "Ngày hiệu lực",
    status: "Trạng thái",
    sealed: "Đã niêm phong",
    notSealed: "Chưa niêm phong",
    client: "BÊN THUÊ",
    contractor: "BÊN THỰC HIỆN",
    clientRole: "Đề xuất thỏa thuận trên Nova",
    contractorRole: "Chấp nhận thỏa thuận trên Nova",
    total: "Tổng giá trị",
    start: "Bắt đầu",
    deadline: "Hạn hoàn thành",
    revisions: "Số lần sửa",
    review: "Nghiệm thu",
    unlimited: "Không giới hạn",
    unset: "Chưa đặt",
    days: (n: number) => `${n} ngày`,
    s1: "Phạm vi công việc",
    s2: "Sản phẩm bàn giao",
    s3: "Tiến độ và thanh toán",
    s4: "Sửa đổi và nghiệm thu",
    s5: "Ghi chú",
    s6: "Thay đổi thỏa thuận",
    period: (a: string, b: string) => `Thời gian thực hiện: ${a} đến ${b}.`,
    colNo: "#",
    colMilestone: "GIAI ĐOẠN",
    colDue: "HẠN",
    colAmount: "SỐ TIỀN",
    totalRow: "Tổng cộng",
    revisionText: (n: number | null) =>
      n === null ? "Không giới hạn số lần sửa đổi." : `Bên thực hiện sửa đổi sản phẩm tối đa ${n} lần trong phạm vi đã thỏa thuận.`,
    reviewText: (n: number | null) =>
      n === null ? "" : `Bên thuê nghiệm thu mỗi giai đoạn trong vòng ${n} ngày kể từ khi bên thực hiện nộp sản phẩm.`,
    amendText:
      "Mọi thay đổi về phạm vi, giá hoặc thời hạn chỉ có hiệu lực khi cả hai bên đồng ý trên Replyn. Mỗi lần thay đổi tạo một phiên bản mới và được niêm phong riêng.",
    acceptance: "Xác nhận của hai bên",
    acceptanceNote: "Hai bên xác nhận điện tử trên Nova; không cần chữ ký tay.",
    proposed: "Đã xác nhận điện tử",
    acceptedAt: (t: string) => `Chấp nhận lúc ${t}`,
    certTitle: "Chứng nhận niêm phong",
    certLead:
      "Dấu vân tay của thỏa thuận này đã được ghi lên chuỗi khối Solana. Không ai, kể cả Replyn, sửa được nội dung mà không bị phát hiện.",
    certLeadUnsealed: "Thỏa thuận này chưa được niêm phong trên chuỗi khối.",
    stampTop: "REPLYN",
    stamp: ["ĐÃ", "NIÊM PHONG"],
    fDoc: "Số thỏa thuận",
    fWorkspace: "Mã workspace",
    fVersion: "Phiên bản",
    fFingerprint: "Dấu vân tay (SHA-256)",
    fNetwork: "Nơi lưu",
    network: (c: string) => (c === "devnet" ? "Solana · devnet (mạng thử nghiệm)" : `Solana · ${c}`),
    fTx: "Mã giao dịch",
    fSealedAt: "Thời điểm niêm phong",
    events: "Nhật ký sự kiện",
    evAccepted: "Hai bên chốt thỏa thuận trên Nova",
    evSealed: "Replyn niêm phong dấu vân tay lên Solana",
    evIssued: "Tạo bản PDF này",
    howTo: "Cách tự kiểm tra",
    steps: (host: string) => [
      `Mở ${host} hoặc quét mã QR bên phải.`,
      "Kéo file PDF này vào ô kiểm tra. Nội dung không rời máy bạn.",
      "Xanh là đúng bản gốc; đỏ là file đã bị sửa.",
    ],
    scan: "Quét để kiểm tra",
    attached: "File PDF này có kèm dữ liệu gốc để kiểm chứng niêm phong.",
    disclaimer:
      "Tài liệu do Replyn tạo tự động từ thỏa thuận hai bên đã chốt trên Nova. Tài liệu không thay thế tư vấn pháp lý.",
    page: (i: number, n: number) => `Trang ${i}/${n}`,
    tz: "(giờ Việt Nam)",
    title: (p: string) => `Thỏa thuận: ${p}`,
    subject: "Bản thỏa thuận đã niêm phong trên Replyn",
    date: (d: string | null) => {
      const m = ymd(d);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : d ?? "Chưa đặt";
    },
    dateTime: (iso: string | null) => {
      const t = vnTime(iso);
      return t
        ? `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}, ${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`
        : null;
    },
    shortDate: (iso: string | null) => {
      const t = vnTime(iso);
      return t ? `${pad2(t.getUTCDate())}.${pad2(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}` : "";
    },
    money: (n: number, c: string) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${c}`,
  },
  en: {
    docType: "SERVICE AGREEMENT",
    docNo: "Agreement no.",
    version: "Version",
    effective: "Effective date",
    status: "Status",
    sealed: "Sealed",
    notSealed: "Not sealed",
    client: "CLIENT",
    contractor: "CONTRACTOR",
    clientRole: "Proposed the agreement on Nova",
    contractorRole: "Accepted the agreement on Nova",
    total: "Total value",
    start: "Start",
    deadline: "Due",
    revisions: "Revisions",
    review: "Review period",
    unlimited: "Unlimited",
    unset: "Not set",
    days: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
    s1: "Scope of work",
    s2: "Deliverables",
    s3: "Schedule and payment",
    s4: "Revisions and acceptance",
    s5: "Notes",
    s6: "Changes to this agreement",
    period: (a: string, b: string) => `Term: ${a} to ${b}.`,
    colNo: "#",
    colMilestone: "MILESTONE",
    colDue: "DUE",
    colAmount: "AMOUNT",
    totalRow: "Total",
    revisionText: (n: number | null) =>
      n === null ? "Revisions are unlimited." : `The Contractor will revise the work up to ${n} time${n === 1 ? "" : "s"} within the agreed scope.`,
    reviewText: (n: number | null) =>
      n === null ? "" : `The Client will review each milestone within ${n} day${n === 1 ? "" : "s"} of the Contractor's submission.`,
    amendText:
      "Changes to scope, price or dates take effect only once both parties agree on Replyn. Each change creates a new version, sealed separately.",
    acceptance: "Acceptance by the parties",
    acceptanceNote: "Both parties confirmed electronically on Nova; no handwritten signature is required.",
    proposed: "Confirmed electronically",
    acceptedAt: (t: string) => `Accepted ${t}`,
    certTitle: "Certificate of seal",
    certLead:
      "The fingerprint of this agreement is recorded on the Solana blockchain. No one, Replyn included, can change the content without it being detected.",
    certLeadUnsealed: "This agreement has not been sealed on the blockchain yet.",
    stampTop: "REPLYN",
    stamp: ["SEALED", ""],
    fDoc: "Agreement no.",
    fWorkspace: "Workspace ID",
    fVersion: "Version",
    fFingerprint: "Fingerprint (SHA-256)",
    fNetwork: "Recorded on",
    network: (c: string) => (c === "devnet" ? "Solana · devnet (test network)" : `Solana · ${c}`),
    fTx: "Transaction",
    fSealedAt: "Sealed at",
    events: "Event log",
    evAccepted: "Both parties finalised the agreement on Nova",
    evSealed: "Replyn sealed the fingerprint on Solana",
    evIssued: "This PDF was issued",
    howTo: "How to verify",
    steps: (host: string) => [
      `Open ${host} or scan the QR code.`,
      "Drop this PDF into the checker. Its content never leaves your device.",
      "Green means it matches the original; red means the file was altered.",
    ],
    scan: "Scan to verify",
    attached: "This PDF carries the original data used to verify the seal.",
    disclaimer:
      "Generated automatically by Replyn from the agreement both parties finalised on Nova. This document is not legal advice.",
    page: (i: number, n: number) => `Page ${i} of ${n}`,
    tz: "(GMT+7)",
    title: (p: string) => `Agreement: ${p}`,
    subject: "Agreement sealed on Replyn",
    date: (d: string | null) => {
      const m = ymd(d);
      return m ? `${MONTHS_EN[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : d ?? "Not set";
    },
    dateTime: (iso: string | null) => {
      const t = vnTime(iso);
      return t
        ? `${MONTHS_EN[t.getUTCMonth()]} ${t.getUTCDate()}, ${t.getUTCFullYear()}, ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`
        : null;
    },
    shortDate: (iso: string | null) => {
      const t = vnTime(iso);
      return t ? `${pad2(t.getUTCDate())} ${MONTHS_EN[t.getUTCMonth()].toUpperCase()} ${t.getUTCFullYear()}` : "";
    },
    money: (n: number, c: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${c}`,
  },
};

/** Giữ cho tương thích và kiểm thử: định dạng ngày giờ theo tiếng Việt. */
export const dateVi = (d: string | null) => T.vi.date(d);
export const dateTimeVi = (iso: string | null) => T.vi.dateTime(iso);

/** Số thỏa thuận dễ đọc, lấy từ mã workspace: RPL-E5420C2F. */
export const agreementNo = (workspaceId: string) => `RPL-${workspaceId.slice(0, 8).toUpperCase()}`;

/* ---------- bố cục ---------- */

// Bảng màu giấy: nền ngà, chữ than chì, một màu nhấn vàng đất (cùng họ với vàng của Replyn nhưng đủ tối để in).
export const C = {
  paper: rgb(0.984, 0.98, 0.969),
  ink: rgb(0.09, 0.1, 0.106),
  ink2: rgb(0.27, 0.29, 0.31),
  muted: rgb(0.48, 0.5, 0.52),
  line: rgb(0.88, 0.865, 0.84),
  accent: rgb(0.62, 0.43, 0.04),
  accentSoft: rgb(0.965, 0.925, 0.8),
  panel: rgb(0.953, 0.945, 0.925),
  white: rgb(1, 1, 1),
};

export const PAGE: [number, number] = [595.28, 841.89]; // A4
const M = 56;
const W = PAGE[0] - M * 2;
const TOP = PAGE[1] - 40; // đường kẻ đầu trang
const FOOT = 52;

/** Ngắt dòng theo từ cho vừa bề rộng; từ quá dài thì cắt theo ký tự. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = "";
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

export async function buildAgreementPdf(file: AgreementFile, fonts: PdfFonts, opts: PdfOptions): Promise<Uint8Array> {
  const a = file.agreement;
  const t = T[opts.locale ?? "vi"];
  const version = opts.version ?? 1;
  const now = opts.now ?? new Date();
  const no = agreementNo(a.workspaceId);
  const money = (n: number) => t.money(n, a.currency);
  const sealed = !!file.seal && !!opts.sealedAt;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fonts.regular, { subset: true });
  const semi = await doc.embedFont(fonts.semibold, { subset: true });

  doc.setTitle(t.title(a.projectName));
  doc.setSubject(t.subject);
  doc.setAuthor("Replyn");
  doc.setCreator("Replyn");
  doc.setProducer("Replyn");
  doc.setLanguage(opts.locale === "en" ? "en" : "vi");
  doc.setKeywords([no, a.workspaceId]);
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  await doc.attach(new TextEncoder().encode(JSON.stringify(file, null, 2)), AGREEMENT_ATTACHMENT, {
    mimeType: "application/json",
    description: "Original agreement data used to verify the seal",
    creationDate: now,
    modificationDate: now,
  });

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = doc.addPage(PAGE);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: C.paper });
    // Đầu trang chạy: thương hiệu bên trái, số thỏa thuận và phiên bản bên phải.
    page.drawText("REPLYN", { x: M, y: TOP + 8, size: 9.5, font: semi, color: C.ink });
    const meta = `${no}  ·  ${t.version} ${version}`;
    page.drawText(meta, { x: M + W - reg.widthOfTextAtSize(meta, 8.5), y: TOP + 8, size: 8.5, font: reg, color: C.muted });
    page.drawLine({ start: { x: M, y: TOP }, end: { x: M + W, y: TOP }, thickness: 0.8, color: C.ink });
    y = TOP - 28;
  };
  const ensure = (h: number) => {
    if (y - h < FOOT + 24) newPage();
  };
  const draw = (s: string, x: number, yy: number, size: number, font: PDFFont, color: RGB = C.ink) =>
    page.drawText(s, { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size: number, font: PDFFont, color: RGB = C.ink) =>
    draw(s, xr - font.widthOfTextAtSize(s, size), yy, size, font, color);
  const hr = (yy: number, x = M, w = W, color = C.line, thickness = 0.6) =>
    page.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness, color });
  const paragraph = (s: string, size = 10.5, font = reg, color: RGB = C.ink, x = M + 22, width = W - 22) => {
    for (const line of wrapText(s, font, size, width)) {
      ensure(size * 1.5);
      y -= size * 1.5;
      draw(line, x, y, size, font, color);
    }
  };
  let clause = 0;
  const section = (title: string) => {
    ensure(52);
    y -= 24;
    clause += 1;
    draw(`${clause}.`, M, y, 11, semi, C.accent);
    draw(title, M + 22, y, 11, semi, C.ink);
    y -= 4;
  };

  /* ----- Trang 1: thỏa thuận ----- */
  newPage();

  draw(t.docType, M, y, 8.5, semi, C.accent);
  y -= 8;
  for (const line of wrapText(a.projectName, semi, 24, W)) {
    y -= 29;
    draw(line, M, y, 24, semi);
  }

  // Dòng thông tin văn bản.
  y -= 26;
  const metaCols: [string, string][] = [
    [t.docNo, no],
    [t.version, String(version)],
    [t.effective, t.date(a.acceptedAt.slice(0, 10))],
    [t.status, sealed ? t.sealed : t.notSealed],
  ];
  const mw = W / metaCols.length;
  metaCols.forEach(([k, v], i) => {
    draw(k, M + i * mw, y, 8, reg, C.muted);
    draw(v, M + i * mw, y - 14, 10, semi, i === 3 && sealed ? C.accent : C.ink);
  });
  y -= 26;
  hr(y);

  // Hai bên.
  y -= 24;
  const half = (W - 16) / 2;
  const accepted = t.dateTime(a.acceptedAt);
  const party = (label: string, name: string, role: string, x: number) => {
    draw(label, x, y, 8, semi, C.muted);
    let yy = y - 18;
    for (const line of wrapText(name, semi, 13, half - 8)) {
      draw(line, x, yy, 13, semi);
      yy -= 16;
    }
    draw(role, x, yy - 1, 9, reg, C.ink2);
    return y - yy + 10;
  };
  const ph = Math.max(
    party(t.client, a.businessName, t.clientRole, M),
    party(t.contractor, a.freelancerName, t.contractorRole, M + half + 16),
  );
  y -= ph;

  // Dải số liệu chính.
  y -= 14;
  const bandH = 56;
  page.drawRectangle({ x: M, y: y - bandH, width: W, height: bandH, color: C.panel });
  const facts: [string, string][] = [
    [t.total, money(a.totalAmount)],
    [t.start, t.date(a.startDate)],
    [t.deadline, t.date(a.deadline)],
    [t.revisions, a.revisionLimit === null ? t.unlimited : String(a.revisionLimit)],
    [t.review, a.reviewPeriodDays === null ? t.unset : t.days(a.reviewPeriodDays)],
  ];
  const fw = W / facts.length;
  facts.forEach(([k, v], i) => {
    const x = M + 14 + i * fw;
    draw(k, x, y - 20, 8, reg, C.muted);
    draw(v, x, y - 37, i === 0 ? 12 : 10.5, semi, i === 0 ? C.accent : C.ink);
  });
  y -= bandH;

  // Điều khoản.
  section(t.s1);
  paragraph(a.scope);

  if (a.deliverables.length) {
    section(t.s2);
    a.deliverables.forEach((d) => {
      wrapText(d, reg, 10.5, W - 36).forEach((line, i) => {
        ensure(17);
        y -= 17;
        if (i === 0) page.drawCircle({ x: M + 26, y: y + 3.5, size: 1.8, color: C.accent });
        draw(line, M + 36, y, 10.5, reg);
      });
    });
  }

  section(t.s3);
  if (a.startDate || a.deadline) paragraph(t.period(t.date(a.startDate), t.date(a.deadline)), 10.5, reg, C.ink2);
  const col = { no: M + 22, title: M + 44, due: M + W - 186, amount: M + W };
  ensure(30);
  y -= 22;
  draw(t.colNo, col.no, y, 8, semi, C.muted);
  draw(t.colMilestone, col.title, y, 8, semi, C.muted);
  draw(t.colDue, col.due, y, 8, semi, C.muted);
  right(t.colAmount, col.amount, y, 8, semi, C.muted);
  y -= 8;
  hr(y, M + 22, W - 22, C.ink2, 0.6);
  a.milestones.forEach((m, i) => {
    const lines = wrapText(m.title, reg, 10.5, col.due - col.title - 14);
    ensure(14 * lines.length + 16);
    y -= 18;
    draw(String(i + 1), col.no, y, 10.5, reg, C.muted);
    lines.forEach((line, j) => draw(line, col.title, y - j * 14, 10.5, reg));
    draw(t.date(m.deadline), col.due, y, 10.5, reg, C.ink2);
    right(money(m.amount), col.amount, y, 10.5, semi);
    y -= 14 * (lines.length - 1) + 9;
    hr(y, M + 22, W - 22);
  });
  ensure(26);
  y -= 20;
  draw(t.totalRow, col.title, y, 10.5, semi);
  right(money(a.totalAmount), col.amount, y, 12, semi, C.accent);

  section(t.s4);
  paragraph(t.revisionText(a.revisionLimit));
  const review = t.reviewText(a.reviewPeriodDays);
  if (review) paragraph(review);

  if (a.notes.trim()) {
    section(t.s5);
    paragraph(a.notes);
  }

  section(t.s6);
  paragraph(t.amendText);

  // Xác nhận của hai bên: khối giống chữ ký, nhưng ghi rõ là xác nhận điện tử. Không đủ chỗ thì chuyển sang đầu trang
  // chứng nhận, để không có trang chỉ chứa mỗi khối này.
  const signH = 112;
  const signOnCertPage = y - signH - 30 < FOOT + 24;
  if (signOnCertPage) newPage();
  else y -= 30;
  draw(t.acceptance, M, y, 11, semi);
  y -= 15;
  draw(t.acceptanceNote, M, y, 9, reg, C.muted);
  y -= 22;
  const sign = (label: string, name: string, line2: string, x: number) => {
    page.drawRectangle({ x, y: y - 58, width: half, height: 58, color: C.panel });
    page.drawRectangle({ x, y: y - 58, width: 2.5, height: 58, color: C.accent });
    draw(label, x + 14, y - 16, 8, semi, C.muted);
    draw(wrapText(name, semi, 11.5, half - 28)[0], x + 14, y - 32, 11.5, semi);
    draw(line2, x + 14, y - 47, 8.5, reg, C.ink2);
  };
  sign(t.client, a.businessName, t.proposed, M);
  sign(t.contractor, a.freelancerName, accepted ? `${t.acceptedAt(accepted)} ${t.tz}` : t.proposed, M + half + 16);
  y -= 58;

  /* ----- Trang chứng nhận niêm phong ----- */
  if (signOnCertPage) y -= 30;
  else newPage();
  const certTop = y;
  draw(t.certTitle, M, y - 4, 20, semi);
  y -= 22;
  const leadW = W - 150;
  for (const line of wrapText(sealed ? t.certLead : t.certLeadUnsealed, reg, 10, leadW)) {
    y -= 15;
    draw(line, M, y, 10, reg, C.ink2);
  }

  // Con dấu ở góc phải tiêu đề.
  const sx = M + W - 52;
  const sy = certTop - 42;
  page.drawCircle({ x: sx, y: sy, size: 44, borderColor: C.accent, borderWidth: 1.6, color: sealed ? C.accentSoft : undefined });
  page.drawCircle({ x: sx, y: sy, size: 38, borderColor: C.accent, borderWidth: 0.6 });
  const mid = (s: string, yy: number, size: number, font: PDFFont) =>
    s && draw(s, sx - font.widthOfTextAtSize(s, size) / 2, yy, size, font, C.accent);
  mid(t.stampTop, sy + 16, 7, semi);
  if (t.stamp[1]) {
    mid(t.stamp[0], sy + 3, 8.5, semi);
    mid(t.stamp[1], sy - 8, 8.5, semi);
  } else mid(t.stamp[0], sy - 3, 10, semi);
  mid(t.shortDate(opts.sealedAt), sy - 22, 7, reg);

  // Bảng thông tin niêm phong, bắt đầu dưới con dấu.
  y = Math.min(y - 30, sy - 58);
  const kx = M;
  const vx = M + 150;
  const vw = W - 150;
  const row = (k: string, v: string, mono = false) => {
    const size = mono ? 8 : 10;
    const lines = wrapText(v, reg, size, vw);
    ensure(lines.length * 12 + 14);
    y -= 15;
    draw(k, kx, y, 9, reg, C.muted);
    lines.forEach((line, i) => draw(line, vx, y - i * 12, size, i === 0 && !mono ? semi : reg, mono ? C.ink2 : C.ink));
    y -= (lines.length - 1) * 12 + 7;
    hr(y);
  };
  hr(y, M, W, C.ink2, 0.6);
  row(t.fDoc, no);
  row(t.fWorkspace, a.workspaceId, true);
  if (file.seal) {
    row(t.fFingerprint, file.seal.hash, true);
    row(t.fNetwork, t.network(file.seal.cluster));
    row(t.fTx, file.seal.signature, true);
  }
  const sealedAt = t.dateTime(opts.sealedAt);
  if (sealedAt) row(t.fSealedAt, `${sealedAt} ${t.tz}`);

  // Nhật ký sự kiện: dòng thời gian dọc.
  y -= 26;
  ensure(100);
  draw(t.events, M, y, 11, semi);
  y -= 6;
  const events: [string, string | null][] = [
    [t.evAccepted, accepted],
    [t.evSealed, sealedAt],
    [t.evIssued, t.dateTime(now.toISOString())],
  ];
  const shown = events.filter(([, at]) => at);
  shown.forEach(([label, at], i) => {
    y -= 22;
    page.drawCircle({ x: M + 5, y: y + 4, size: 4, color: i === shown.length - 1 ? C.white : C.accent, borderColor: C.accent, borderWidth: 1.2 });
    if (i < shown.length - 1) page.drawLine({ start: { x: M + 5, y: y - 1 }, end: { x: M + 5, y: y - 17 }, thickness: 1, color: C.line });
    draw(label, M + 22, y, 10, reg);
    right(`${at}`, M + W, y, 9.5, reg, C.ink2);
  });

  // Cách tự kiểm tra + mã QR.
  y -= 26;
  const boxH = 118;
  ensure(boxH + 10);
  page.drawRectangle({ x: M, y: y - boxH, width: W, height: boxH, color: C.panel });
  const qs = 84;
  const qx = M + W - qs - 18;
  const qy = y - 14 - qs;
  drawQr(page, opts.verifyUrl, qx, qy, qs);
  const scanW = reg.widthOfTextAtSize(t.scan, 8);
  draw(t.scan, qx + (qs - scanW) / 2, qy - 11, 8, reg, C.muted);
  draw(t.howTo, M + 18, y - 26, 11, semi);
  let sy2 = y - 48;
  const host = opts.verifyUrl.replace(/^https?:\/\//, "");
  t.steps(host).forEach((s, i) => {
    draw(`${i + 1}`, M + 18, sy2, 9.5, semi, C.accent);
    for (const line of wrapText(s, reg, 9.5, qx - M - 60)) {
      draw(line, M + 34, sy2, 9.5, reg, C.ink2);
      sy2 -= 14;
    }
    sy2 -= 4;
  });
  y -= boxH;

  // Lưu ý cuối trang chứng nhận.
  y -= 22;
  for (const line of wrapText(`${t.attached} ${t.disclaimer}`, reg, 8, W)) {
    draw(line, M, y, 8, reg, C.muted);
    y -= 12;
  }

  // Chân trang mọi trang.
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: FOOT }, end: { x: M + W, y: FOOT }, thickness: 0.5, color: C.line });
    p.drawText(`Replyn  ·  ${no}`, { x: M, y: FOOT - 14, size: 7.5, font: reg, color: C.muted });
    const n = t.page(i + 1, pages.length);
    p.drawText(n, { x: M + W - reg.widthOfTextAtSize(n, 7.5), y: FOOT - 14, size: 7.5, font: reg, color: C.muted });
  });

  return doc.save();
}

function drawQr(page: PDFPage, data: string, x: number, y: number, size: number) {
  const qr = qrcode(0, "M");
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y, width: size, height: size, color: C.white });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      page.drawRectangle({
        x: x + (c + quiet) * cell,
        y: y + size - (r + quiet + 1) * cell,
        width: cell + 0.05,
        height: cell + 0.05,
        color: C.ink,
      });
    }
  }
}

const nameOf = (v: unknown) => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : null);

/** Lấy dữ liệu gốc đính kèm trong PDF do Replyn tạo. Không phải PDF hoặc không có tệp đính kèm thì trả null. */
export async function readAgreementFromPdf(bytes: Uint8Array | ArrayBuffer): Promise<unknown | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
    const files = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
    const list = files?.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (!list) return null;
    for (let i = 0; i + 1 < list.size(); i += 2) {
      if (nameOf(list.lookup(i)) !== AGREEMENT_ATTACHMENT) continue;
      const spec = list.lookupMaybe(i + 1, PDFDict);
      const stream = spec?.lookupMaybe(PDFName.of("EF"), PDFDict)?.lookup(PDFName.of("F"));
      if (!(stream instanceof PDFRawStream)) return null;
      return JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
    }
    return null;
  } catch {
    return null;
  }
}
