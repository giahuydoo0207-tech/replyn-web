import { handleWorkspaces, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

/** Một workspace; server kiểm tra người đang đăng nhập có thuộc workspace này không. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleWorkspaces(request, liveAuthDeps(), (await params).id);
}
