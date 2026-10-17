import { createHmac, timingSafeEqual } from "node:crypto";
import { agreementHash, isAgreementHash, type AgreementReceipt, type CanonicalAgreement } from "./agreement";

/**
 * Chữ ký xác nhận của Replyn cho một bản thỏa thuận: HMAC-SHA256 trên (mã workspace, dấu vân tay, thời điểm ký).
 * Thay cho niêm phong trên chuỗi khối: không cần ví, không tốn phí, không cần cơ sở dữ liệu. Đổi lại, chỉ server
 * giữ khóa mới kiểm tra được chữ ký, và ai đổi khóa (REPLYN_SESSION_SECRET) thì các bản cũ không còn kiểm chứng được.
 * Chỉ chạy trên server.
 */
const CONTEXT = "replyn-agreement-receipt-v1";

const mac = (workspaceId: string, hash: string, signedAt: string, secret: string) =>
  createHmac("sha256", secret).update(`${CONTEXT}.${workspaceId}.${hash}.${signedAt}`).digest();

export async function signReceipt(agreement: CanonicalAgreement, secret: string, now: Date): Promise<AgreementReceipt> {
  const hash = await agreementHash(agreement);
  const signedAt = now.toISOString();
  return { hash, signedAt, signature: mac(agreement.workspaceId, hash, signedAt, secret).toString("base64url") };
}

/** Chữ ký có đúng do server này cấp cho đúng workspace và đúng dấu vân tay ghi trong phần xác nhận không. */
export function receiptIsGenuine(workspaceId: string, receipt: AgreementReceipt, secret: string): boolean {
  if (!isAgreementHash(receipt.hash)) return false;
  const expected = mac(workspaceId, receipt.hash, receipt.signedAt, secret);
  const given = Buffer.from(receipt.signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type VerifyStatus =
  /** Chữ ký thật và nội dung file đúng bản đã ký. */
  | "match"
  /** Chữ ký thật nhưng nội dung file đã bị sửa sau khi ký. */
  | "modified"
  /** Có phần xác nhận nhưng chữ ký không do Replyn này cấp (giả, hoặc khóa đã đổi). */
  | "invalid"
  /** File không có phần xác nhận. */
  | "unsigned";

export async function verifyAgreement(
  agreement: CanonicalAgreement,
  receipt: AgreementReceipt | null,
  secret: string,
): Promise<{ status: VerifyStatus; hash: string }> {
  const hash = await agreementHash(agreement);
  if (!receipt) return { status: "unsigned", hash };
  if (!receiptIsGenuine(agreement.workspaceId, receipt, secret)) return { status: "invalid", hash };
  return { status: receipt.hash === hash ? "match" : "modified", hash };
}
