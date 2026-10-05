"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { clearTabLogin, consumePendingLogin } from "./auth/demoSession";
import { fetchNovaSession, logoutBusiness, type NovaIdentity } from "./auth/novaBusinessClient";
import { me, reducer, type Action, type AppState } from "./reducer";
import { initialState } from "./seed";

const StoreCtx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

interface NovaSession {
  /** Danh tính Nova (Business hoặc Talent) đã được server xác minh từ cookie phiên; không có subjectId hay Nova Key. */
  identity: NovaIdentity | null;
  /** Đăng xuất Nova. False nếu server chưa xóa được phiên; khi đó vẫn giữ trạng thái đăng nhập. */
  signOut: () => Promise<boolean>;
}

const NovaSessionCtx = createContext<NovaSession | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [notice, setNotice] = useState<string | null>(null);
  const [identity, setIdentity] = useState<NovaIdentity | null>(null);

  // Đăng nhập Nova: mở đúng cuộc trò chuyện một lần sau khi mount. Vai trò (Business hoặc Freelancer)
  // chỉ đến từ cookie phiên do server xác minh, nên refresh trang vẫn giữ đúng vai.
  useEffect(() => {
    let alive = true;
    fetchNovaSession().then((verified) => {
      if (!alive || !verified) return;
      setIdentity(verified);
      dispatch({ type: "SET_ROLE", role: verified.role });
    });
    const pending = consumePendingLogin();
    if (pending) {
      dispatch({ type: "SELECT_CHAT", chatId: pending.conversationId });
      const message = pending.notice;
      // hiện sau lần render đầu; không hủy trong cleanup vì StrictMode chạy effect hai lần mà pending chỉ đọc được một lần
      if (message) window.setTimeout(() => setNotice(message), 0);
    }
    return () => {
      alive = false;
    };
  }, []);

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
  const session = useMemo(() => ({ identity, signOut }), [identity, signOut]);

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
