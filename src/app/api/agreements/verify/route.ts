import { canonicalAgreement, readReceipt } from "@/lib/agreement/agreement";
import { verifyAgreement } from "@/lib/agreement/receipt";
import { readSecret } from "@/lib/auth/session";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Công khai: đối chiếu một bản thỏa thuận (nội dung + phần xác nhận trong file) với chữ ký của Replyn. */
export async function POST(request: Request) {
  const secret = readSecret();
  if (!secret) return json(503, { error: "not_configured" });
  const raw = await request.text();
  if (raw.length > 64 * 1024) return json(413, { error: "too_large" });
  let body: { agreement?: unknown; receipt?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" });
  }
  const agreement = canonicalAgreement(body.agreement);
  if (!agreement) return json(400, { error: "invalid_agreement" });
  const receipt = readReceipt(body.receipt);
  const result = await verifyAgreement(agreement, receipt, secret);
  return json(200, { ...result, signedAt: receipt?.signedAt ?? null });
}
