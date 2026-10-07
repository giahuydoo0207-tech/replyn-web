"use client";

import {
  ArrowLeft,
  Bell,
  BellOff,
  ChevronRight,
  FilePen,
  Image as ImageIcon,
  LibraryBig,
  Mail,
  Lock,
  MoreVertical,
  Paperclip,
  Pin,
  Plus,
  Search,
  SendHorizontal,
  Smile,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usdc } from "@/lib/fees";
import { sha256Hex } from "@/lib/format";
import { previewOf } from "@/lib/preview";
import { nextAction } from "@/lib/protection";
import { pinnedMessages } from "@/lib/reducer";
import { jumpToMessage, useActiveChat, useMe, useStore } from "@/lib/store";
import type { Conversation, Message, Workspace } from "@/lib/types";
import { useWorkspaceActions } from "../actions";
import { Avatar, cx, IconButton, ReplynMark } from "../ui";
import { MessageList } from "./Messages";
import { ProposeChangeDialog } from "../panel/ScopeChange";
import { pendingChange } from "@/lib/scopeChange";

export function ChatView({ onBack }: { onBack?: () => void }) {
  const { conv, ws, messages } = useActiveChat();
  const { state, dispatch } = useStore();
  const meId = useMe();
  const dialogs = useWorkspaceActions();
  const scroller = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [opening, setOpening] = useState(false);
  const modeTimers = useRef<number[]>([]);

  useEffect(() => () => modeTimers.current.forEach(window.clearTimeout), []);

  // Dự án luôn mở vào hội thoại workspace; trao đổi trước khi chốt chỉ còn trong tab Lưu trữ.
  const redirectTo = conv && !conv.workspaceId && conv.linkedWorkspaceChatId && state.conversations[conv.linkedWorkspaceChatId]
    ? conv.linkedWorkspaceChatId
    : null;
  useEffect(() => {
    if (redirectTo) dispatch({ type: "SELECT_CHAT", chatId: redirectTo });
  }, [redirectTo, dispatch]);

  // vào chat: nhảy xuống cuối ngay lập tức
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv?.id]);

  // có tin mới: cuộn mượt xuống cuối
  const count = messages.length;
  useEffect(() => {
    const el = scroller.current;
    if (el && !state.ui.flashId) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!conv || redirectTo) return <EmptyState />;

  const submittable = ws?.milestones.find((m) => ["funded_sim", "revision_requested"].includes(m.status));
  const canSubmit = !!ws && meId === ws.freelancerId && !!submittable;
  const shownMessages = searchQuery.trim()
    ? messages.filter((m) => !m.recalledAt && (m.text ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;
  const sourceChat = conv.sourceNovaChatId ? state.conversations[conv.sourceNovaChatId] : undefined;

  // Icon bìa: mở hồ sơ dự án (Công cụ dự án) ở tab Lưu trữ, có hiệu ứng mở bìa.
  const openBinder = () => {
    if (!ws || opening) return;
    setSearchOpen(false);
    setSearchQuery("");
    setOpening(true);
    modeTimers.current.push(window.setTimeout(() => dispatch({ type: "SET_PANEL", tab: "archive", open: true }), 520));
  };

  const onDropFile = async (file: File) => {
    if (ws && canSubmit && submittable) {
      dialogs.submit({ wsId: ws.id, milestoneId: submittable.id }, file);
      return;
    }
    const hash = await sha256Hex(file);
    dispatch({
      type: "SEND_FILE",
      chatId: conv.id,
      file: { name: file.name, size: file.size, hash, kind: file.type.startsWith("image/") ? "image" : "file" },
    });
  };

  return (
    <section aria-label={`Trò chuyện: ${sourceChat?.title ?? conv.title}`} className="relative isolate flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <ChatHeader
        conv={conv}
        ws={ws}
        onBack={onBack}
        onSearch={() => setSearchOpen((v) => !v)}
        onOpenBinder={ws ? openBinder : undefined}
      />
      {searchOpen && <ChatSearch value={searchQuery} onChange={setSearchQuery} count={shownMessages.length} onClose={() => { setSearchOpen(false); setSearchQuery(""); }} />}
      {ws && <ProjectTaskBar ws={ws} />}
      {ws && <PinnedBar chatId={conv.id} />}

      <div
        className="chat-canvas relative min-h-0 flex-1"
        onDragOver={(e) => {
          if (conv.kind === "channel") return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void onDropFile(f);
        }}
      >
        <div ref={scroller} className="thin-scroll absolute inset-0 overflow-y-auto">
          {conv.kind === "nova" && (
            <p className="mx-auto mt-4 flex w-fit max-w-[90%] items-start gap-1.5 rounded-lg bg-notice/95 px-3 py-1.5 text-center text-xs text-ink-2">
              <Lock size={12} className="mt-0.5 shrink-0" />
              Lịch sử trao đổi trên Nova, chỉ để xem. Đề xuất được doanh nghiệp gửi và freelancer phản hồi trên Nova.
            </p>
          )}
          <MessageList conv={conv} messages={shownMessages} />
          {searchQuery.trim() && shownMessages.length === 0 && <p className="mx-auto mt-12 w-fit rounded-lg bg-notice px-3 py-2 text-sm text-ink-2">Không tìm thấy tin nhắn phù hợp.</p>}
        </div>
        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-white/40 bg-black/70">
            <div className="text-center">
              <Upload className="mx-auto text-ink" size={34} />
              <p className="mt-2 text-lg font-semibold">
                {canSubmit ? "Thả file để nộp sản phẩm" : "Thả file để gửi"}
              </p>
              {canSubmit && submittable && (
                <p className="text-sm text-ink-2">
                  {submittable.title} · {usdc(submittable.amount)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <Composer conv={conv} ws={ws} canSubmit={canSubmit} onFile={onDropFile} onSubmitWork={() => ws && submittable && dialogs.submit({ wsId: ws.id, milestoneId: submittable.id })} />
      {opening && <BinderTransition />}
    </section>
  );
}

/* ---------- Header ---------- */

function ChatHeader({ conv, ws, onBack, onSearch, onOpenBinder }: { conv: Conversation; ws?: Workspace; onBack?: () => void; onSearch: () => void; onOpenBinder?: () => void }) {
  const { state } = useStore();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sourceChat = conv.sourceNovaChatId ? state.conversations[conv.sourceNovaChatId] : undefined;
  const linkedWorkspace = conv.linkedWorkspaceChatId ? state.conversations[conv.linkedWorkspaceChatId] : undefined;
  const displayConv = sourceChat ?? conv;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-white/5 bg-sidebar px-3 sm:px-4">
      {onBack && (
        <IconButton label="Quay lại" onClick={onBack} className="md:hidden">
          <ArrowLeft size={20} />
        </IconButton>
      )}
      <Avatar {...displayConv.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold leading-tight">
          <span className="truncate">{displayConv.title}</span>
          {(sourceChat || linkedWorkspace || conv.kind === "nova") && (
            <span className="hidden shrink-0 rounded bg-white/6 px-1.5 text-[11px] font-medium text-ink-2 sm:inline">
              {ws ? "Hồ sơ công việc" : linkedWorkspace ? "Hội thoại" : "Nova Chat"}
            </span>
          )}
        </h2>
        <p className="truncate text-[13px] text-muted">
          {ws ? ws.title : linkedWorkspace?.workspaceId ? `Dự án · ${state.workspaces[linkedWorkspace.workspaceId]?.title ?? linkedWorkspace.title}` : conv.kind === "nova" ? "vừa truy cập" : conv.subtitle}
        </p>
      </div>
      <div className="relative flex shrink-0 items-center gap-0.5" ref={menuRef}>
        <IconButton label="Tìm trong cuộc trò chuyện" className="hidden sm:grid" onClick={onSearch}>
          <Search size={20} />
        </IconButton>
        {onOpenBinder && (
          <IconButton label="Mở hồ sơ dự án" aria-pressed={false} onClick={onOpenBinder}>
            <LibraryBig size={20} />
          </IconButton>
        )}
        <IconButton label="Tùy chọn" active={menu} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <MoreVertical size={20} />
        </IconButton>
        {menu && <ConversationMenu conv={conv} onSearch={onSearch} onClose={() => setMenu(false)} />}
      </div>
    </header>
  );
}

function BinderTransition() {
  return (
    <div className="workspace-switch" aria-hidden>
      <div className="workspace-switch__binder">
        <div className="workspace-switch__binder-back" />
        <div className="workspace-switch__paper workspace-switch__paper--back" />
        <div className="workspace-switch__paper workspace-switch__paper--front">
          <span className="workspace-switch__lines" />
        </div>
        <div className="workspace-switch__rings" aria-hidden>
          <i /><i /><i />
        </div>
        <div className="workspace-switch__binder-cover">
          <LibraryBig size={30} />
          <span>Mở hồ sơ dự án</span>
        </div>
      </div>
    </div>
  );
}

function ChatSearch({ value, onChange, count, onClose }: { value: string; onChange: (value: string) => void; count: number; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-sidebar px-3 py-2 sm:px-4">
      <Search size={17} className="text-muted" />
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="Tìm trong cuộc trò chuyện" className="h-9 min-w-0 flex-1 rounded-lg bg-white/6 px-3 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-white/20" />
      <span className="whitespace-nowrap text-xs text-muted">{value.trim() ? `${count} kết quả` : "Nhập từ khóa"}</span>
      <IconButton label="Đóng tìm kiếm" onClick={onClose} className="size-9"><X size={17} /></IconButton>
    </div>
  );
}

function ProjectTaskBar({ ws }: { ws: Workspace }) {
  const { dispatch } = useStore();
  const meId = useMe();
  const next = nextAction(ws, meId);
  if (!next.tab) return null;
  return <button type="button" onClick={() => dispatch({ type: "SET_PANEL", tab: next.tab!, open: true })} className="flex w-full shrink-0 items-center gap-2.5 border-b border-line bg-sidebar px-4 py-2 text-left text-[13px] hover:bg-white/[0.03]"><span className={cx("size-2 shrink-0 rounded-full", next.urgent === "danger" ? "bg-danger" : "bg-amber")} /><span className="min-w-0 flex-1 truncate"><span className="text-muted">Việc cần làm: </span><span className="font-medium text-ink">{next.text}</span></span><span className="text-xs font-medium text-link">Mở</span><ChevronRight size={15} className="text-muted" /></button>;
}

/**
 * Thanh ghim đầu chat như ghim tin nhắn thường: bấm để nhảy tới tin, mỗi lần bấm chuyển sang tin ghim kế tiếp.
 * "Xem tất cả" mở Lưu trữ ở mục Đã ghim.
 */
function PinnedBar({ chatId }: { chatId: string }) {
  const { state, dispatch } = useStore();
  const pins = pinnedMessages(state, chatId);
  const [index, setIndex] = useState(0);
  if (pins.length === 0) return null;
  const i = index % pins.length;
  const m: Message = pins[i];
  const sender = state.users[m.senderId];
  return (
    <div className="flex w-full shrink-0 items-center gap-1 border-b border-line bg-sidebar pl-2 pr-2 text-[13px]">
      <button
        type="button"
        onClick={() => {
          jumpToMessage(dispatch, m.id);
          setIndex(i + 1);
        }}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-white/[0.03] active:scale-[0.99]"
        aria-label={`Tin nhắn đã ghim ${i + 1} trên ${pins.length}. Bấm để xem trong chat`}
      >
        {pins.length > 1 ? (
          <span aria-hidden className="flex h-7 w-[3px] shrink-0 flex-col gap-[2px]">
            {pins.slice(0, 4).map((p, k) => (
              <span key={p.id} className={cx("flex-1 rounded-full", k === Math.min(i, 3) ? "bg-yellow" : "bg-white/15")} />
            ))}
          </span>
        ) : (
          <span aria-hidden className="h-7 w-[3px] shrink-0 rounded-full bg-yellow" />
        )}
        <Pin size={15} className="shrink-0 rotate-45 text-yellow" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-yellow">
            Tin nhắn đã ghim{pins.length > 1 ? ` · ${i + 1}/${pins.length}` : ""}
          </span>
          <span className="block truncate text-ink-2">
            <span className="text-ink">{sender?.name ?? "Người dùng"}: </span>
            {previewOf(state, m)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "SET_PANEL", tab: "archive", open: true, archiveFilter: "pinned" })}
        className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-link hover:bg-white/[0.04] active:scale-[0.98]"
      >
        Xem tất cả
      </button>
    </div>
  );
}

/** Chỉ các thao tác với cuộc trò chuyện; công cụ dự án nằm sau icon bìa. */
function ConversationMenu({ conv, onSearch, onClose }: { conv: Conversation; onSearch: () => void; onClose: () => void }) {
  const { dispatch } = useStore();
  const run = (fn: () => void) => { fn(); onClose(); };
  const item = "flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover";
  return (
    <div role="menu" aria-label="Tùy chọn cuộc trò chuyện" className="msg-in absolute right-0 top-11 z-40 w-[280px] overflow-hidden rounded-xl bg-panel py-1.5 shadow-2xl ring-1 ring-line">
      <button role="menuitem" onClick={() => run(onSearch)} className={item}><Search size={18} className="text-ink-2" />Tìm trong cuộc trò chuyện</button>
      <button role="menuitem" onClick={() => run(() => dispatch({ type: "TOGGLE_PIN", chatId: conv.id }))} className={item}><Pin size={18} className="text-ink-2" />{conv.pinned ? "Bỏ ghim cuộc trò chuyện" : "Ghim cuộc trò chuyện"}</button>
      <button role="menuitem" onClick={() => run(() => dispatch({ type: "TOGGLE_MUTE", chatId: conv.id }))} className={item}>{conv.muted ? <Bell size={18} className="text-ink-2" /> : <BellOff size={18} className="text-ink-2" />}{conv.muted ? "Bật thông báo" : "Tắt thông báo"}</button>
      <button role="menuitem" onClick={() => run(() => dispatch({ type: "MARK_UNREAD", chatId: conv.id }))} className={item}><Mail size={18} className="text-ink-2" />Đánh dấu chưa đọc</button>
    </div>
  );
}

/* ---------- Composer ---------- */

function Composer({
  conv,
  ws,
  canSubmit,
  onFile,
  onSubmitWork,
}: {
  conv: Conversation;
  ws?: Workspace;
  canSubmit: boolean;
  onFile: (f: File) => void;
  onSubmitWork: () => void;
}) {
  const { dispatch } = useStore();
  const meId = useMe();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [proposing, setProposing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  if (conv.kind === "channel") {
    return (
      <div className="shrink-0 border-t border-white/5 bg-sidebar px-4 py-4 text-center text-sm text-muted">
        Chỉ Đội ngũ Nova có thể đăng trong kênh này
      </div>
    );
  }
  // Hội thoại chỉ-xem (dữ liệu mẫu): trao đổi trước khi có workspace.
  if (conv.kind === "nova") {
    return (
      <div className="shrink-0 border-t border-white/5 bg-sidebar px-4 py-4 text-center text-sm text-muted">
        Lịch sử trao đổi chỉ để xem.
      </div>
    );
  }

  const send = () => {
    const t = text.trim();
    if (!t) return;
    dispatch({ type: "SEND_TEXT", chatId: conv.id, text: t });
    setText("");
  };

  type ItemId = "file" | "image" | "submit" | "change";
  type Item = { id: ItemId; label: string; hint?: string; icon: ReactNode; disabled?: boolean; accent?: boolean };
  const items: Item[] = [
    { id: "file", label: "Gửi tệp", icon: <Paperclip size={18} /> },
    { id: "image", label: "Gửi ảnh", icon: <ImageIcon size={18} /> },
  ];
  if (ws && canSubmit) {
    items.push({ id: "submit", label: "Nộp sản phẩm", hint: "Gắn vào milestone đang chạy", icon: <Upload size={18} />, accent: true });
  }
  // Lối tắt đổi phạm vi ngay trong lúc nhắn tin; chỉ hai bên của workspace đã chốt thỏa thuận mới thấy.
  if (ws && (ws.termsLockedAt || ws.agreement) && (meId === ws.businessId || meId === ws.freelancerId)) {
    const waiting = !!pendingChange(ws);
    items.push({
      id: "change",
      label: "Đề xuất thay đổi thỏa thuận",
      hint: waiting ? "Đang có một đề xuất chờ trả lời" : "Đổi giá, hạn hoặc thêm bớt giai đoạn",
      icon: <FilePen size={18} />,
      disabled: waiting,
    });
  }
  const runItem = (id: ItemId) => {
    if (id === "file") fileInput.current?.click();
    else if (id === "image") imageInput.current?.click();
    else if (id === "change") setProposing(true);
    else onSubmitWork();
  };

  return (
    <div className="shrink-0 bg-sidebar px-2 pb-3 pt-2 sm:px-4">
      <div className="relative flex items-end gap-2" ref={menuRef}>
        {menu && (
          <div role="menu" className="msg-in absolute bottom-[56px] left-0 z-30 w-72 rounded-2xl bg-panel p-1.5 shadow-2xl ring-1 ring-line">
            {items.map((it) => (
              <button
                key={it.id}
                role="menuitem"
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  runItem(it.id);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span
                  className={cx(
                    "grid size-9 place-items-center rounded-full",
                    it.accent ? "bg-white/12 text-ink" : "bg-white/6 text-ink-2",
                  )}
                >
                  {it.icon}
                </span>
                <span>
                  <span className="block text-[15px] font-medium">{it.label}</span>
                  {it.hint && <span className="block text-xs text-ink-2">{it.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex min-h-[48px] flex-1 items-end gap-1 rounded-3xl bg-white/6 px-1.5 py-1">
          <IconButton
            label="Thêm"
            aria-haspopup="menu"
            aria-expanded={menu}
            active={menu}
            onClick={() => setMenu((v) => !v)}
            className={cx("transition-transform", menu && "rotate-45")}
          >
            <Plus size={22} />
          </IconButton>
          <IconButton label="Biểu tượng cảm xúc" className="hidden sm:grid">
            <Smile size={21} />
          </IconButton>
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Soạn tin nhắn"
            aria-label="Soạn tin nhắn"
            className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] leading-6 text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={send}
          aria-label="Gửi"
          disabled={!text.trim()}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-yellow text-[#0B0D0A] transition hover:bg-[#f7d064] disabled:bg-white/6 disabled:text-muted"
        >
          <SendHorizontal size={22} />
        </button>
        <input ref={fileInput} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {proposing && ws && <ProposeChangeDialog ws={ws} onClose={() => setProposing(false)} />}
    </div>
  );
}

/* ---------- Empty state ---------- */

function EmptyState() {
  return (
    <section className="chat-canvas hidden h-full flex-1 flex-col items-center justify-center px-8 text-center md:flex">
      <ReplynMark size={64} />
      <h2 className="mt-5 text-2xl font-bold">Replyn</h2>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">Chat, thỏa thuận dự án và bằng chứng ở cùng một nơi.</p>
      <p className="mt-6 max-w-sm text-sm text-muted">
        Chọn một workspace để theo dõi tiến độ. Workspace mới xuất hiện khi freelancer chấp nhận đề xuất mà doanh nghiệp gửi trên Nova.
      </p>
    </section>
  );
}
