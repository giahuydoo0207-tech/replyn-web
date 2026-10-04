import { handleSession, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

/** Phiên Replyn hiện tại, đọc từ cookie đã ký. */
export function GET(request: Request) {
  return handleSession(request, liveAuthDeps());
}
