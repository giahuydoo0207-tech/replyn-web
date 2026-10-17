/**
 * Dấu vân tay thỏa thuận: mã băm SHA-256 của bản thỏa thuận đã chuẩn hóa. Chỉ cần sửa một ký tự là mã khác hẳn.
 * Dùng chung cho server (ký xác nhận) và trình duyệt (tab Thỏa thuận, trang Kiểm chứng), nên không import gì riêng
 * của Node.
 */

export const AGREEMENT_FORMAT = "replyn-agreement/2";

export interface AgreementTerms {
  workspaceId: string;
  /** Phiên bản thỏa thuận: 1 là bản gốc, tăng mỗi lần hai bên đồng ý đổi phạm vi. */
  version: number;
  projectName: string;
  scope: string;
  deliverables: string[];
  revisionLimit: number | null;
  currency: string;
  totalAmount: number;
  startDate: string | null;
  deadline: string | null;
  reviewPeriodDays: number | null;
  milestones: { title: string; amount: number; deadline: string | null }[];
  notes: string;
  /** Lúc cả hai bên xác nhận thỏa thuận trên Replyn. */
  acceptedAt: string;
  businessName: string;
  freelancerName: string;
}

/** Bản thỏa thuận chuẩn hóa: thứ tự trường cố định, chỉ các điều khoản đã chốt. */
export interface CanonicalAgreement extends AgreementTerms {
  format: typeof AGREEMENT_FORMAT;
}

/** Xác nhận của Replyn: server ký HMAC lên dấu vân tay, nên file bị sửa sẽ không còn khớp chữ ký. */
export interface AgreementReceipt {
  hash: string;
  /** ISO, lúc Replyn ký. */
  signedAt: string;
  /** HMAC-SHA256, base64url. Chỉ server Replyn kiểm tra được. */
  signature: string;
}

/** File người dùng tải về từ tab Thỏa thuận (JSON, hoặc đính kèm trong PDF) và thả vào trang Kiểm chứng. */
export interface AgreementFile {
  format: typeof AGREEMENT_FORMAT;
  agreement: CanonicalAgreement;
  receipt: AgreementReceipt | null;
}

const WORKSPACE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HASH = /^[0-9a-f]{64}$/;

// NFC: cùng một chữ tiếng Việt có thể được lưu theo hai cách (dựng sẵn hoặc tổ hợp dấu); chuẩn hóa để không báo sai.
const text = (v: unknown) => (typeof v === "string" ? v.normalize("NFC") : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const optNum = (v: unknown) => (v === null || v === undefined ? null : num(v) ?? undefined);
const optText = (v: unknown) => (v === null || v === undefined ? null : text(v) ?? undefined);

/**
 * Dựng bản chuẩn từ dữ liệu bất kỳ (workspace đang mở hoặc file người dùng tải lên). Sai kiểu ở bất kỳ trường nào
 * thì trả null, không đoán. `acceptedAt` được đưa về ISO đầy đủ để cùng một thời điểm luôn cho cùng mã băm.
 */
export function canonicalAgreement(raw: unknown): CanonicalAgreement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  const workspaceId = text(w.workspaceId)?.toLowerCase() ?? null;
  const acceptedMs = typeof w.acceptedAt === "string" ? Date.parse(w.acceptedAt) : NaN;
  const version = w.version === undefined ? 1 : num(w.version);
  const revisionLimit = optNum(w.revisionLimit);
  const reviewPeriodDays = optNum(w.reviewPeriodDays);
  const startDate = optText(w.startDate);
  const deadline = optText(w.deadline);
  const fields = [w.projectName, w.scope, w.notes, w.currency, w.businessName, w.freelancerName].map(text);
  const totalAmount = num(w.totalAmount);
  if (
    !workspaceId || !WORKSPACE_ID.test(workspaceId) || !Number.isFinite(acceptedMs) || fields.some((f) => f === null) ||
    version === null || !Number.isInteger(version) || version < 1 ||
    totalAmount === null || revisionLimit === undefined || reviewPeriodDays === undefined ||
    startDate === undefined || deadline === undefined || !Array.isArray(w.deliverables) || !Array.isArray(w.milestones)
  ) {
    return null;
  }
  const deliverables = w.deliverables.map(text);
  if (deliverables.some((d) => d === null)) return null;
  const milestones: CanonicalAgreement["milestones"] = [];
  for (const item of w.milestones) {
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    const title = text(m.title);
    const amount = num(m.amount);
    const due = optText(m.deadline);
    if (title === null || amount === null || due === undefined) return null;
    milestones.push({ title, amount, deadline: due });
  }
  const [projectName, scope, notes, currency, businessName, freelancerName] = fields as string[];
  return {
    format: AGREEMENT_FORMAT,
    workspaceId,
    version,
    projectName,
    scope,
    deliverables: deliverables as string[],
    revisionLimit,
    currency,
    totalAmount,
    startDate,
    deadline,
    reviewPeriodDays,
    milestones,
    notes,
    acceptedAt: new Date(acceptedMs).toISOString(),
    businessName,
    freelancerName,
  };
}

/** Chuỗi được băm: toàn bộ điều khoản đã chốt kèm tên hai bên, thứ tự trường cố định. */
export function canonicalJson(a: CanonicalAgreement): string {
  return JSON.stringify({
    format: a.format,
    workspaceId: a.workspaceId,
    version: a.version,
    projectName: a.projectName,
    scope: a.scope,
    deliverables: a.deliverables,
    revisionLimit: a.revisionLimit,
    currency: a.currency,
    totalAmount: a.totalAmount,
    startDate: a.startDate,
    deadline: a.deadline,
    reviewPeriodDays: a.reviewPeriodDays,
    milestones: a.milestones.map(({ title, amount, deadline }) => ({ title, amount, deadline })),
    notes: a.notes,
    acceptedAt: a.acceptedAt,
    businessName: a.businessName,
    freelancerName: a.freelancerName,
  });
}

/** SHA-256 (hex) của bản chuẩn. Web Crypto có sẵn trong trình duyệt và Node 20+. */
export async function agreementHash(agreement: CanonicalAgreement): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(agreement)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const isAgreementHash = (value: unknown): value is string => typeof value === "string" && HASH.test(value);

/** Đọc phần xác nhận trong file; sai dạng thì coi như không có. */
export function readReceipt(raw: unknown): AgreementReceipt | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isAgreementHash(r.hash) || typeof r.signedAt !== "string" || !Number.isFinite(Date.parse(r.signedAt))) return null;
  if (typeof r.signature !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(r.signature)) return null;
  return { hash: r.hash, signedAt: r.signedAt, signature: r.signature };
}

/** Số thỏa thuận dễ đọc, dựa trên mã workspace: "ws-moc" -> "RPL-WS-MOC". */
export const agreementNo = (workspaceId: string) => `RPL-${workspaceId.toUpperCase().slice(0, 24)}`;
