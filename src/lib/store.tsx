"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import type { DemoAccount } from "./auth/accounts";
import { me, reducer, visibleTo, type Action, type AppState } from "./reducer";
import { initialState } from "./seed";

const StoreCtx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

interface AccountSession {
  /** Tài khoản đã đăng nhập, do server xác minh từ cookie phiên. */
  account: DemoAccount;
  /** Đăng xuất. False nếu server chưa xóa được phiên. */
  signOut: () => Promise<boolean>;
}

const AccountCtx = createContext<AccountSession | null>(null);

/** Ngồi đúng ghế của tài khoản: vai trò và người dùng hiện tại luôn theo tài khoản đăng nhập, không đổi được trong app. */
function seat(state: AppState, account: DemoAccount): AppState {
  if (state.role === account.role && state.roleUser[account.role] === account.id) return state;
  const s: AppState = { ...state, role: account.role, roleUser: { ...state.roleUser, [account.role]: account.id } };
  const active = s.ui.activeChatId;
  if (active && !visibleTo(s, active)) return { ...s, ui: { ...s.ui, activeChatId: s.order.find((c) => visibleTo(s, c)) ?? null } };
  return s;
}

/**
 * Dữ liệu demo lưu trong trình duyệt, dùng chung cho mọi tài khoản mẫu trên cùng máy: đăng xuất rồi đăng nhập bằng
 * tài khoản bên kia là thấy đúng dự án vừa làm. Không có backend nên máy khác không thấy.
 */
const STORAGE_KEY = "replyn-demo-state-v2";

function loadSaved(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as AppState) : null;
    return s && typeof s === "object" && s.workspaces && s.conversations && s.messages && s.users && s.ui ? s : null;
  } catch {
    return null;
  }
}

function save(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ui: { ...state.ui, flashId: null } }));
  } catch {
    // Trình duyệt chặn lưu (chế độ riêng tư, hết dung lượng): vẫn chạy được, chỉ không giữ dữ liệu khi tải lại.
  }
}

/**
 * Dữ liệu chat và dự án là reducer trong trình duyệt (chưa có backend), dựng từ dữ liệu mẫu.
 * Tài khoản đăng nhập quyết định mình là ai trong dữ liệu đó.
 */
export function StoreProvider({ children, account }: { children: ReactNode; account: DemoAccount }) {
  const seated = useCallback((s: AppState, a: Action) => seat(reducer(s, a), account), [account]);
  const [state, dispatch] = useReducer(seated, undefined, () => seat(initialState(), account));
  const restored = useRef(false);

  // Khôi phục sau khi mount (server không đọc được localStorage), rồi lưu sau mỗi thay đổi.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) dispatch({ type: "REPLACE", state: saved });
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    const id = window.setTimeout(() => save(state), 200);
    return () => window.clearTimeout(id);
  }, [state]);

  // Nhắc hạn tự động: kiểm tra khi mở app và mỗi phút. Giờ thật chỉ đẩy đồng hồ tới (demo đang ở tương lai thì giữ nguyên).
  useEffect(() => {
    const check = () => dispatch({ type: "CHECK_REMINDERS", now: Date.now() });
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const signOut = useCallback(async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    if (!res?.ok) return false;
    window.location.replace("/login");
    return true;
  }, []);
  const session = useMemo(() => ({ account, signOut }), [account, signOut]);

  return (
    <StoreCtx.Provider value={{ state, dispatch }}>
      <AccountCtx.Provider value={session}>{children}</AccountCtx.Provider>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Tài khoản đang đăng nhập và lệnh đăng xuất. */
export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used inside <StoreProvider>");
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
