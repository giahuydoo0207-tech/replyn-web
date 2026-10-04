import { handleBusinessLogin, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

/** Đăng nhập Nova Business: xác minh Nova ID + Nova Key với Nova backend, đặt cookie phiên Replyn. */
export function POST(request: Request) {
  return handleBusinessLogin(request, liveAuthDeps());
}
