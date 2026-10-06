"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { clearTabLogin, consumePendingLogin, type PendingLogin } from "./auth/demoSession";
import { fetchNovaSession, logoutBusiness, type NovaIdentity } from "./auth/novaBusinessClient";
import { fetchNovaWorkspaces } from "./auth/novaWorkspaceClient";
import { activeNovaWorkspace, me, novaWsId, reducer, wsChatId, type Action, type AppState } from "./reducer";
import { initialState, novaSessionState } from "./seed";

const StoreCtx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

interface NovaSession {
  /** Danh tính Nova (Business hoặc Talent) đã được server xác minh từ cookie phiên; không có subjectId hay Nova Key. */
  identity: NovaIdentity | null;
  /** Đăng xuất Nova. False nếu server chưa xóa được phiên; khi đó vẫn giữ trạng thái đăng nhập. */
  signOut: () => Promise<boolean>;
  /**
   * Phiên Nova thật (hoặc route /workspace/{id}, vốn bắt buộc đăng nhập): không có dữ liệu mẫu, không có đổi vai,
   * cảnh demo hay đặt lại demo. False: chế độ demo ẩn danh, giữ nguyên như cũ.
   */
  realSession: boolean;
  /** Đã nạp xong workspace thật từ Nova (kể cả khi không có workspace nào). */
  workspacesLoaded: boolean;
}

const NovaSessionCtx = createContext<NovaSession | null>(null);

/**
 * `workspaceId`: workspace Nova cần mở (route /workspace/{id}). Chưa đăng nhập thì chuyển sang đăng nhập Nova
 * rồi quay lại đúng đường dẫn này; server kiểm tra quyền truy cập workspace.
 */
export function StoreProvider({ children, workspaceId }: { children: ReactNode; workspaceId?: string }) {
  // /workspace/{id} luôn cần phiên Nova thật nên không dựng dữ liệu mẫu; trang chủ giữ demo tới khi xác minh xong phiên.
  const [state, dispatch] = useReducer(reducer, workspaceId, (id?: string) =>
    id ? novaSessionState({ role: "business", name: "Tài khoản Nova" }, 0) : initialState(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [identity, setIdentity] = useState<NovaIdentity | null>(null);
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false);
  // Đọc đúng một lần: StrictMode chạy effect hai lần mà sessionStorage chỉ trả kết quả đăng nhập ở lần đầu.
  const pendingRef = useRef<PendingLogin | null | undefined>(undefined);

  // Đăng nhập Nova: mở đúng cuộc trò chuyện một lần sau khi mount. Vai trò (Business hoặc Freelancer)
  // chỉ đến từ cookie phiên do server xác minh, nên refresh trang vẫn giữ đúng vai.
  useEffect(() => {
    let alive = true;
    const firstRun = pendingRef.current === undefined;
    if (firstRun) pendingRef.current = consumePendingLogin();
    const pending = pendingRef.current;
    // hiện sau lần render đầu, không hủy trong cleanup
    const show = (message: string) => window.setTimeout(() => setNotice(message), 0);
    if (pending) {
      dispatch({ type: "SELECT_CHAT", chatId: pending.conversationId });
      if (pending.notice && firstRun) show(pending.notice);
    }
    fetchNovaSession().then(async (verified) => {
      if (!alive) return;
      if (!verified) {
        if (workspaceId) window.location.replace(`/auth/nova?returnTo=${encodeURIComponent(`/workspace/${workspaceId}`)}`);
        return;
      }
      setIdentity(verified);
      const viewer = { role: verified.role, name: verified.displayName };
      // Phiên thật: bỏ ngay toàn bộ người, cuộc trò chuyện và workspace mẫu, kể cả trong lúc chờ Nova trả workspace.
      dispatch({ type: "REPLACE", state: novaSessionState(viewer, Date.now()) });
      const [list, target] = await Promise.all([
        fetchNovaWorkspaces(),
        workspaceId ? fetchNovaWorkspaces(workspaceId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      const workspaces = [...(target?.kind === "ok" ? target.workspaces : []), ...(list.kind === "ok" ? list.workspaces : [])]
        .filter((w, i, all) => all.findIndex((x) => x.workspaceId === w.workspaceId) === i);
      if (workspaces.length) {
        dispatch({ type: "LOAD_NOVA_WORKSPACES", viewer, workspaces });
      }
      setWorkspacesLoaded(true);
      const open = (id: string, tab: "terms" | "milestones") => {
        dispatch({ type: "SELECT_CHAT", chatId: wsChatId(novaWsId(id)) });
        dispatch({ type: "SET_PANEL", tab, open: tab === "terms" });
      };
      if (workspaceId) {
        if (target?.kind === "ok" && target.workspaces[0]) {
          open(target.workspaces[0].workspaceId, "terms");
        } else if (target?.kind === "not_found") {
          show("Không tìm thấy workspace hoặc bạn không có quyền truy cập.");
        } else {
          show("Chưa tải được workspace từ Nova. Hãy tải lại trang.");
        }
      } else if (pending && workspaces[0]) {
        // Vừa đăng nhập không kèm workspace: cuộc trò chuyện mẫu không còn trong phiên thật, nên mở thỏa thuận
        // được chấp nhận gần nhất.
        open(workspaces[0].workspaceId, "milestones");
      } else if (list.kind !== "ok") {
        show("Chưa tải được workspace từ Nova. Hãy tải lại trang.");
      }
    });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const signOut = useCallback(async () => {
    if (!(await logoutBusiness())) return false;
    clearTabLogin();
    setIdentity(null);
    window.location.replace("/auth/nova");
    return true;
  }, []);
  const realSession = identity !== null || !!workspaceId;
  const session = useMemo(
    () => ({ identity, signOut, realSession, workspacesLoaded }),
    [identity, signOut, realSession, workspacesLoaded],
  );

  // Workspace thật đang mở (hội thoại hoặc công cụ dự án) → /workspace/{id}, để tải lại trang vẫn mở đúng workspace
  // cho cả Business lẫn Freelancer. Dữ liệu mẫu không có id Nova nên URL demo giữ nguyên.
  const activeNovaWorkspaceId = activeNovaWorkspace(state);
  useEffect(() => {
    if (!activeNovaWorkspaceId) return;
    const path = `/workspace/${encodeURIComponent(activeNovaWorkspaceId)}`;
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
  }, [activeNovaWorkspaceId]);

  return (
    <StoreCtx.Provider value={{ state, dispatch }}>
      <NovaSessionCtx.Provider value={session}>
        {children}
        {notice && (
          <div role="status" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
            <span className="rounded-full bg-panel px-4 py-2 text-sm font-medium text-ink shadow-2xl ring-1 ring-line">{notice}</span>
          </div>
        )}
      </NovaSessionCtx.Provider>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Phiên Nova thật của trình duyệt (null khi chưa đăng nhập bằng Nova ID hoặc mã QR). */
export function useNovaSession() {
  const ctx = useContext(NovaSessionCtx);
  if (!ctx) throw new Error("useNovaSession must be used inside <StoreProvider>");
  return ctx;
}

/** id người dùng hiện tại theo vai trò đang xem */
export function useMe() {
  const { state } = useStore();
  return me(state);
}

export function useActiveChat() {
  const { state } = useStore();
  const id = state.ui.activeChatId;
  const conv = id ? state.conversations[id] : undefined;
  const ws = conv?.workspaceId ? state.workspaces[conv.workspaceId] : undefined;
  return { conv, ws, messages: id ? (state.messages[id] ?? []) : [] };
}

/** Cuộn tới tin nhắn trong khung chat và nháy viền vàng */
export function jumpToMessage(dispatch: Dispatch<Action>, messageId: string) {
  dispatch({ type: "SET_PANEL", open: false });
  dispatch({ type: "FLASH", id: messageId });
  requestAnimationFrame(() => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  setTimeout(() => dispatch({ type: "FLASH", id: null }), 1700);
}

/** Mở tab Bằng chứng và nháy sự kiện liên quan */
export function jumpToEvidence(dispatch: Dispatch<Action>, evidenceId: string) {
  dispatch({ type: "SET_PANEL", tab: "evidence", open: true });
  dispatch({ type: "FLASH", id: evidenceId });
  setTimeout(() => {
    document.getElementById(`ev-${evidenceId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 60);
  setTimeout(() => dispatch({ type: "FLASH", id: null }), 1700);
}
