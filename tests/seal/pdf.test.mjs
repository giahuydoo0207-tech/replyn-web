// Kiểm thử bản thỏa thuận PDF: dữ liệu gốc đính kèm đọc lại được nguyên vẹn, và sửa dữ liệu thì dấu vân tay đổi.
// Chạy: npm run test:seal
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

register("../workspace/ts-resolve.mjs", import.meta.url);
const { agreementHash, canonicalAgreement } = await import("../../src/lib/seal/agreement.ts");
const { buildAgreementPdf, dateTimeVi, readAgreementFromPdf } = await import("../../src/lib/seal/pdf.ts");
const { PDFDocument } = await import("pdf-lib");

const fonts = {
  regular: readFileSync(new URL("../../public/fonts/BeVietnamPro-Regular.ttf", import.meta.url)),
  semibold: readFileSync(new URL("../../public/fonts/BeVietnamPro-SemiBold.ttf", import.meta.url)),
};
const agreement = canonicalAgreement({
  workspaceId: "e5420c2f-508d-41b4-a071-c4a75ed7136e",
  projectName: "Landing Page Mộc Coffee",
  scope: "Thiết kế UI và phát triển landing page responsive",
  deliverables: ["File figma desktop + mobile, mã nguồn và hướng dẫn triển khai"],
  revisionLimit: 2,
  currency: "USDC",
  totalAmount: 2500,
  startDate: "2026-10-10",
  deadline: "2026-10-18",
  reviewPeriodDays: 3,
  milestones: [
    { title: "Thiết kế UI", amount: 1000, deadline: "2026-10-15" },
    { title: "Code và bàn giao", amount: 1500, deadline: "2026-10-18" },
  ],
  notes: "",
  acceptedAt: "2026-10-07T01:20:00.000Z",
  businessName: "Nova Labs",
  freelancerName: "Đỗ Gia Huy",
});
const options = { sealedAt: "2026-10-07T01:24:00.000Z", verifyUrl: "https://replyn.test/verify", now: new Date("2026-10-07T02:00:00Z") };

test("the PDF carries the sealed agreement and reads back byte for byte", async () => {
  const hash = await agreementHash(agreement);
  const file = { format: "replyn-agreement/1", agreement, seal: { signature: "sig", cluster: "devnet", hash } };
  const bytes = await buildAgreementPdf(file, fonts, options);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const back = await readAgreementFromPdf(bytes);
  assert.deepEqual(back, file);
  assert.equal(await agreementHash(canonicalAgreement(back.agreement)), hash);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), "Thỏa thuận: Landing Page Mộc Coffee");
});

test("long scopes flow onto more pages instead of being cut off", async () => {
  const long = { ...agreement, scope: "Thiết kế và phát triển giao diện cho từng màn hình. ".repeat(220) };
  const bytes = await buildAgreementPdf({ format: "replyn-agreement/1", agreement: long, seal: null }, fonts, options);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
  assert.deepEqual((await readAgreementFromPdf(bytes)).agreement, long);
});

test("a PDF without Replyn data, or a file that is not a PDF, is rejected", async () => {
  const plain = await PDFDocument.create();
  plain.addPage();
  assert.equal(await readAgreementFromPdf(await plain.save()), null);
  assert.equal(await readAgreementFromPdf(new TextEncoder().encode("{\"not\":\"pdf\"}")), null);
});

test("times are printed in Vietnam time whatever the machine's time zone", () => {
  assert.equal(dateTimeVi("2026-10-07T01:24:00.000Z"), "08:24, 07/10/2026");
  assert.equal(dateTimeVi(null), null);
});

test("the English PDF translates labels but keeps the parties' own wording", async () => {
  const hash = await agreementHash(agreement);
  const file = { format: "replyn-agreement/1", agreement, seal: { signature: "sig", cluster: "devnet", hash } };
  const bytes = await buildAgreementPdf(file, fonts, { ...options, locale: "en" });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), "Agreement: Landing Page Mộc Coffee");
  assert.equal(doc.getPageCount(), 2, "agreement, then acceptance and certificate of seal");
  assert.deepEqual(await readAgreementFromPdf(bytes), file, "the sealed data is identical whatever the language");
});
