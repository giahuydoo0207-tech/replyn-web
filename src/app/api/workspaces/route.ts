import { handleWorkspaces, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

/** Workspace Replyn (từ đề xuất Nova đã chấp nhận) mà người đang đăng nhập là một bên. */
export function GET(request: Request) {
  return handleWorkspaces(request, liveAuthDeps(), null);
}
