"use client";

import {
  ArrowLeft,
  Bell,
  BellOff,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  Paperclip,
  Pin,
  Plus,
  Search,
  SendHorizontal,
  ShieldCheck,
  Smile,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usdc } from "@/lib/fees";
import { sha256Hex } from "@/lib/format";
import { nextAction } from "@/lib/protection";
import { useActiveChat, useMe, useStore } from "@/lib/store";
import type { Conversation, Workspace } from "@/lib/types";
import { useWorkspaceActions } from "../actions";
import { PROJECT_TOOLS } from "../projectTools";
import { Avatar, Button, cx, IconButton, ReplynMark } from "../ui";
import { MessageList } from "./Messages";

export function ChatView({ onBack }: { onBack?: () => void }) {
  const { conv, ws, messages } = useActiveChat();
  const { state, dispatch } = useStore();
  const meId = useMe();
  const dialogs = useWorkspaceActions();
  const scroller = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  if (!conv) return <EmptyState />;

  const submittable = ws?.milestones.find((m) => ["funded_sim", "revision_requested"].includes(m.status));
  const canSubmit = !!ws && meId === ws.freelancerId && !!submittable;
  const shownMessages = searchQuery.trim()
    ? messages.filter((m) => (m.text ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

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
    <section aria-label={`Trò chuyện: ${conv.title}`} className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <ChatHeader conv={conv} ws={ws} onBack={onBack} onSearch={() => setSearchOpen((v) => !v)} />
      {searchOpen && <ChatSearch value={searchQuery} onChange={setSearchQuery} count={shownMessages.length} onClose={() => { setSearchOpen(false); setSearchQuery(""); }} />}
      {ws && <ProjectTaskBar ws={ws} />}
      {conv.id === "nova-khoa" && !conv.proposalStatus && <NudgeBar conv={conv} />}

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
              Nova Chat dùng để phỏng vấn và chọn nhau. Khi bắt đầu có tiền, deadline và bàn giao, hãy chuyển sang Replyn.
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
    </section>
  );
}

/* ---------- Header ---------- */

function ChatHeader({ conv, ws, onBack, onSearch }: { conv: Conversation; ws?: Workspace; onBack?: () => void; onSearch: () => void }) {
  const { state, dispatch } = useStore();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sourceChat = conv.sourceNovaChatId ? state.conversations[conv.sourceNovaChatId] : undefined;

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
      <Avatar {...conv.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold leading-tight">
          <span className="truncate">{conv.title}</span>
          {conv.kind === "nova" && (
            <span className="hidden shrink-0 rounded bg-white/6 px-1.5 text-[11px] font-medium text-ink-2 sm:inline">Nova Chat</span>
          )}
        </h2>
        {/* tagline: vị trí thứ 2 (cùng proposal card) */}
        {sourceChat ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "SELECT_CHAT", chatId: sourceChat.id })}
            className="flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-link hover:underline"
            aria-label={`Quay lại Nova Chat với ${sourceChat.title}`}
          >
            <ArrowLeft size={13} className="shrink-0" />
            <span className="truncate">Quay lại Nova Chat với {sourceChat.title}</span>
          </button>
        ) : (
          <p className="truncate text-[13px] text-muted">
            {ws
              ? "Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc."
              : conv.kind === "nova"
                ? "vừa truy cập"
                : conv.subtitle}
          </p>
        )}
      </div>
      <div className="relative flex shrink-0 items-center gap-0.5" ref={menuRef}>
        <IconButton label="Tìm trong cuộc trò chuyện" className="hidden sm:grid" onClick={onSearch}>
          <Search size={20} />
        </IconButton>
        <IconButton label="Tùy chọn" active={menu} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <MoreVertical size={20} />
        </IconButton>
        {menu && <ConversationMenu conv={conv} ws={ws} onSearch={onSearch} onClose={() => setMenu(false)} />}
      </div>
    </header>
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

function ConversationMenu({ conv, ws, onSearch, onClose }: { conv: Conversation; ws?: Workspace; onSearch: () => void; onClose: () => void }) {
  const { dispatch } = useStore();
  const openTool = (tab: (typeof PROJECT_TOOLS)[number]["tab"]) => { dispatch({ type: "SET_PANEL", tab, open: true }); onClose(); };
  const run = (fn: () => void) => { fn(); onClose(); };
  return (
    <div role="menu" aria-label="Tùy chọn cuộc trò chuyện" className="msg-in absolute right-0 top-11 z-40 w-[300px] overflow-hidden rounded-xl bg-panel py-1.5 shadow-2xl ring-1 ring-line">
      {ws && <><p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted">Công cụ dự án</p>{PROJECT_TOOLS.map((item) => <button key={item.tab} role="menuitem" onClick={() => openTool(item.tab)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover"><item.icon size={18} className="text-ink-2" /><span className="min-w-0"><span className="block text-sm font-medium">{item.menuLabel}</span><span className="block truncate text-xs text-muted">{item.hint}</span></span></button>)}</>}
      {!ws && conv.proposal && !conv.proposalStatus && <button role="menuitem" onClick={() => run(() => dispatch({ type: "PROPOSE_REPLYN", chatId: conv.id }))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover"><ShieldCheck size={18} className="text-yellow" /><span><span className="block text-sm font-medium">Đề xuất Replyn</span><span className="block text-xs text-muted">Chuyển từ trao đổi sang làm việc</span></span></button>}
      <div className={cx(ws && "mt-1 border-t border-line pt-1")}>
        <button role="menuitem" onClick={() => run(onSearch)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover"><Search size={18} className="text-ink-2" />Tìm trong cuộc trò chuyện</button>
        <button role="menuitem" onClick={() => run(() => dispatch({ type: "TOGGLE_PIN", chatId: conv.id }))} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover"><Pin size={18} className="text-ink-2" />{conv.pinned ? "Bỏ ghim cuộc trò chuyện" : "Ghim cuộc trò chuyện"}</button>
        <button role="menuitem" onClick={() => run(() => dispatch({ type: "TOGGLE_MUTE", chatId: conv.id }))} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover">{conv.muted ? <Bell size={18} className="text-ink-2" /> : <BellOff size={18} className="text-ink-2" />}{conv.muted ? "Bật thông báo" : "Tắt thông báo"}</button>
      </div>
    </div>
  );
}

function NudgeBar({ conv }: { conv: Conversation }) {
  const { dispatch } = useStore();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-sidebar px-4 py-2">
      <ReplynMark size={26} />
      <p className="min-w-0 flex-1 text-[13px] text-ink-2">
        <span className="hidden sm:inline">
          Dự án này có giá trị, deadline và bàn giao. Bạn có muốn bảo vệ hai bên bằng Replyn không?
        </span>
        <span className="sm:hidden">Bảo vệ hai bên bằng Replyn?</span>
      </p>
      <Button variant="primary" className="!px-3 !py-1.5" onClick={() => dispatch({ type: "PROPOSE_REPLYN", chatId: conv.id })}>
        Đề xuất Replyn
      </Button>
      <IconButton label="Ẩn gợi ý" onClick={() => setHidden(true)} className="size-8">
        <X size={16} />
      </IconButton>
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
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
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

  const send = () => {
    const t = text.trim();
    if (!t) return;
    dispatch({ type: "SEND_TEXT", chatId: conv.id, text: t });
    setText("");
  };

  const proposalUsed = !!conv.proposalStatus && conv.proposalStatus !== "later";
  type ItemId = "file" | "image" | "propose" | "submit";
  type Item = { id: ItemId; label: string; hint?: string; icon: ReactNode; disabled?: boolean; accent?: boolean };
  const items: Item[] = [
    { id: "file", label: "Gửi tệp", icon: <Paperclip size={18} /> },
    { id: "image", label: "Gửi ảnh", icon: <ImageIcon size={18} /> },
  ];
  // Nova Chat chỉ có 3 mục: thỏa thuận & milestone chỉ được tạo trong workspace Replyn
  if (conv.kind === "nova" && conv.proposal) {
    items.push({
      id: "propose",
      label: "Đề xuất Replyn",
      hint: proposalUsed ? "Đã gửi đề xuất" : "Khóa điều khoản, milestone, bằng chứng",
      icon: <ShieldCheck size={18} />,
      disabled: proposalUsed,
      accent: true,
    });
  }
  if (ws && canSubmit) {
    items.push({ id: "submit", label: "Nộp sản phẩm", hint: "Gắn vào milestone đang chạy", icon: <Upload size={18} />, accent: true });
  }
  const runItem = (id: ItemId) => {
    if (id === "file") fileInput.current?.click();
    else if (id === "image") imageInput.current?.click();
    else if (id === "propose") dispatch({ type: "PROPOSE_REPLYN", chatId: conv.id });
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
        Chọn một cuộc trò chuyện, hoặc mở “Đề xuất Replyn” trong Nova Chat để tạo workspace có milestone và bằng chứng dự án.
      </p>
    </section>
  );
}
