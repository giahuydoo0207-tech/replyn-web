import type { AuthResponseBody, PublicWorkspace } from "./server/novaBusinessAuth";

/**
 * Phía trình duyệt: hỏi server Replyn các workspace của người đang đăng nhập. Server đọc danh tính từ cookie
 * phiên và hỏi Nova; trình duyệt không gửi id người dùng nào.
 */
export type WorkspaceFetch =
  | { kind: "ok"; workspaces: PublicWorkspace[] }
  | { kind: "unauthenticated" | "not_found" | "unavailable" };

export async function fetchNovaWorkspaces(workspaceId?: string): Promise<WorkspaceFetch> {
  const path = workspaceId ? `/api/workspaces/${encodeURIComponent(workspaceId)}` : "/api/workspaces";
  try {
    const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 404) return { kind: "not_found" };
    const body = (await response.json().catch(() => null)) as AuthResponseBody | null;
    if (response.ok && body && "workspaces" in body) return { kind: "ok", workspaces: body.workspaces };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
