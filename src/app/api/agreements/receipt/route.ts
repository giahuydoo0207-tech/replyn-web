import { canonicalAgreement } from "@/lib/agreement/agreement";
import { signReceipt } from "@/lib/agreement/receipt";
import { accountFromRequest, readSecret } from "@/lib/auth/session";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/**
 * Replyn ký xác nhận một bản thỏa thuận. Chỉ người đã đăng nhập và là một trong hai bên của thỏa thuận mới xin được.
 * Bản demo chưa có backend nên server không đối chiếu với dữ liệu lưu riêng: nó ký đúng nội dung được gửi lên.
 */
export async function POST(request: Request) {
  const secret = readSecret();
  if (!secret) return json(503, { error: "not_configured" });
  const account = accountFromRequest(request);
  if (!account) return json(401, { error: "unauthenticated" });
  const raw = await request.text();
  if (raw.length > 64 * 1024) return json(413, { error: "too_large" });
  let body: { agreement?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" });
  }
  const agreement = canonicalAgreement(body.agreement);
  if (!agreement) return json(400, { error: "invalid_agreement" });
  const name = account.name.normalize("NFC");
  if (agreement.businessName !== name && agreement.freelancerName !== name) return json(403, { error: "not_a_party" });
  return json(200, { agreement, receipt: await signReceipt(agreement, secret, new Date()) });
}
