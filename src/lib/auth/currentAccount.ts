import { cookies } from "next/headers";
import type { DemoAccount } from "./accounts";
import { readSecret, SESSION_COOKIE, verifySession } from "./session";

/** Tài khoản đang đăng nhập, đọc từ cookie trong Server Component. */
export async function currentAccount(): Promise<DemoAccount | null> {
  // Đọc cookie trước: trang luôn render theo từng request, kể cả khi thiếu secret lúc build.
  const jar = await cookies();
  const secret = readSecret();
  if (!secret) return null;
  return verifySession(jar.get(SESSION_COOKIE)?.value, secret, Math.floor(Date.now() / 1000));
}
