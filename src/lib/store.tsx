"use client";

import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { consumePendingLogin, readTabRole } from "./auth/demoSession";
import { me, reducer, type Action, type AppState } from "./reducer";
import { initialState } from "./seed";

const StoreCtx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [notice, setNotice] = useState<string | null>(null);

  // Đăng nhập Nova (mock): áp vai trò của tab và mở đúng cuộc trò chuyện một lần sau khi mount
  useEffect(() => {
    const role = readTabRole();
    if (role) dispatch({ type: "SET_ROLE", role });
    const pending = consumePendingLogin();
    if (!pending) return;
    dispatch({ type: "SELECT_CHAT", chatId: pending.conversationId });
    const message = pending.notice;
    // hiện sau lần render đầu; không hủy trong cleanup vì StrictMode chạy effect hai lần mà pending chỉ đọc được một lần
    if (message) window.setTimeout(() => setNotice(message), 0);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  return (
    <StoreCtx.Provider value={{ state, dispatch }}>
      {children}
      {notice && (
        <div role="status" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
          <span className="rounded-full bg-panel px-4 py-2 text-sm font-medium text-ink shadow-2xl ring-1 ring-line">{notice}</span>
        </div>
      )}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
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
