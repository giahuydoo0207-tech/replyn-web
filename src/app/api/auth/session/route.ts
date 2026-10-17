import { accountFromRequest } from "@/lib/auth/session";

/** Tài khoản đang đăng nhập, đọc từ cookie đã ký. */
export function GET(request: Request) {
  const account = accountFromRequest(request);
  return new Response(JSON.stringify(account ? { account } : { account: null }), {
    status: account ? 200 : 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
