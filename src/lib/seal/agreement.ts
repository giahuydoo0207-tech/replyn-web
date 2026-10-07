/**
 * Niêm phong thỏa thuận: chỉ mã băm SHA-256 của thỏa thuận được ghi lên Solana (qua Memo), nội dung thì không.
 * Dùng chung cho server (tạo và tra niêm phong) và trình duyệt (trang Kiểm chứng), nên không import gì riêng của Node.
 */

export const AGREEMENT_FORMAT = "replyn-agreement/1";
export const SEAL_MEMO_PREFIX = "replyn:seal:1:";

export interface SealableAgreement {
  workspaceId: string;
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
  acceptedAt: string;
  businessName: string;
  freelancerName: string;
}

/** Bản thỏa thuận chuẩn hóa: thứ tự trường cố định, chỉ các điều khoản đã chốt (không có vai người xem hay liên kết). */
export interface CanonicalAgreement extends SealableAgreement {
  format: typeof AGREEMENT_FORMAT;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const SEAL_IN_MEMO = /replyn:seal:1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{64})/;

// NFC: cùng một chữ tiếng Việt có thể được lưu theo hai cách (dựng sẵn hoặc tổ hợp dấu); chuẩn hóa để không báo sai.
const text = (v: unknown) => (typeof v === "string" ? v.normalize("NFC") : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const optNum = (v: unknown) => (v === null || v === undefined ? null : num(v) ?? undefined);
const optText = (v: unknown) => (v === null || v === undefined ? null : text(v) ?? undefined);

/**
 * Dựng bản chuẩn từ dữ liệu bất kỳ (workspace từ Nova hoặc file người dùng tải lên). Sai kiểu ở bất kỳ trường nào
 * thì trả null, không đoán. `acceptedAt` được đưa về ISO đầy đủ để cùng một thời điểm luôn cho cùng mã băm.
 */
export function canonicalAgreement(raw: unknown): CanonicalAgreement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  const workspaceId = text(w.workspaceId)?.toLowerCase() ?? null;
  const acceptedMs = typeof w.acceptedAt === "string" ? Date.parse(w.acceptedAt) : NaN;
  const revisionLimit = optNum(w.revisionLimit);
  const reviewPeriodDays = optNum(w.reviewPeriodDays);
  const startDate = optText(w.startDate);
  const deadline = optText(w.deadline);
  const fields = [w.projectName, w.scope, w.notes, w.currency, w.businessName, w.freelancerName].map(text);
  const totalAmount = num(w.totalAmount);
  if (
    !workspaceId || !UUID.test(workspaceId) || !Number.isFinite(acceptedMs) || fields.some((f) => f === null) ||
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

/**
 * Chuỗi được băm: các điều khoản đã chốt, thứ tự trường cố định. Tên hiển thị của hai bên KHÔNG nằm trong mã băm vì
 * người dùng có thể đổi tên trên Nova sau này; hai bên đã được gắn với workspace qua `workspaceId`.
 */
export function canonicalJson(agreement: CanonicalAgreement): string {
  const { format, workspaceId, projectName, scope, deliverables, revisionLimit, currency, totalAmount, startDate, deadline,
    reviewPeriodDays, milestones, notes, acceptedAt } = agreement;
  return JSON.stringify({
    format, workspaceId, projectName, scope, deliverables, revisionLimit, currency, totalAmount, startDate, deadline,
    reviewPeriodDays, milestones: milestones.map(({ title, amount, deadline: due }) => ({ title, amount, deadline: due })),
    notes, acceptedAt,
  });
}

/** SHA-256 (hex) của bản chuẩn. Web Crypto có sẵn trong trình duyệt và Node 20+. */
export async function agreementHash(agreement: CanonicalAgreement): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(agreement)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sealMemo(workspaceId: string, hash: string): string {
  if (!UUID.test(workspaceId) || !HASH.test(hash)) throw new Error("invalid seal");
  return `${SEAL_MEMO_PREFIX}${workspaceId}:${hash}`;
}

/** RPC trả memo dạng "[độ dài] nội dung" (nhiều memo nối bằng "; "); chỉ lấy đúng mẫu niêm phong của Replyn. */
export function parseSealMemo(memo: string | null | undefined): { workspaceId: string; hash: string } | null {
  const match = memo ? SEAL_IN_MEMO.exec(memo) : null;
  return match ? { workspaceId: match[1], hash: match[2] } : null;
}

export const isAgreementHash = (value: unknown): value is string => typeof value === "string" && HASH.test(value);
export const isWorkspaceId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

export const explorerTxUrl = (signature: string, cluster: SealCluster) =>
  `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster === "mainnet" ? "" : `?cluster=${cluster}`}`;

export type SealCluster = "devnet" | "testnet" | "mainnet";

/** File người dùng tải về từ tab Thỏa thuận và thả vào trang Kiểm chứng. */
export interface AgreementFile {
  format: typeof AGREEMENT_FORMAT;
  agreement: CanonicalAgreement;
  seal: { signature: string; cluster: SealCluster; hash: string } | null;
}
