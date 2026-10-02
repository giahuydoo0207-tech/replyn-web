"use client";

import {
  ArrowLeft,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  PanelRight,
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
import { useActiveChat, useMe, useStore } from "@/lib/store";
import type { Conversation, Workspace } from "@/lib/types";
import { useWorkspaceActions } from "../actions";
import { Avatar, Button, cx, IconButton, ReplynMark } from "../ui";
import { MessageList } from "./Messages";

export function ChatView({ onBack }: { onBack?: () => void }) {
  const { conv, ws, messages } = useActiveChat();
  const { state, dispatch } = useStore();
  const meId = useMe();
  const dialogs = useWorkspaceActions();
  const scroller = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

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
      <ChatHeader conv={conv} ws={ws} onBack={onBack} />
      {ws && <PinnedTerms ws={ws} />}
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
          <MessageList conv={conv} messages={messages} />
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

function ChatHeader({ conv, ws, onBack }: { conv: Conversation; ws?: Workspace; onBack?: () => void }) {
  const { state, dispatch } = useStore();
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
        <p className="truncate text-[13px] text-muted">
          {ws
            ? "Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc."
            : conv.kind === "nova"
              ? "vừa truy cập"
              : conv.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Tìm trong cuộc trò chuyện" className="hidden sm:grid">
          <Search size={20} />
        </IconButton>
        {ws && (
          <>
            <IconButton
              label="Bằng chứng dự án"
              active={state.ui.panelOpen && state.ui.panelTab === "evidence"}
              onClick={() => dispatch({ type: "SET_PANEL", tab: "evidence", open: true })}
            >
              <ShieldCheck size={20} />
            </IconButton>
            <IconButton
              label={state.ui.panelOpen ? "Ẩn Replyn Protection" : "Hiện Replyn Protection"}
              active={state.ui.panelOpen}
              onClick={() => dispatch({ type: "SET_PANEL", open: !state.ui.panelOpen })}
            >
              <PanelRight size={20} />
            </IconButton>
          </>
        )}
        <IconButton label="Tùy chọn">
          <MoreVertical size={20} />
        </IconButton>
      </div>
    </header>
  );
}

/* ---------- Dòng ghim kiểu Telegram: điều khoản + nhắc demo mô phỏng ---------- */

function PinnedTerms({ ws }: { ws: Workspace }) {
  const { dispatch } = useStore();
  const total = ws.milestones.reduce((a, m) => a + m.amount, 0);
  const locked = !!ws.termsLockedAt;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "SET_PANEL", tab: "terms", open: true })}
      className="flex w-full shrink-0 items-center gap-2.5 border-b border-white/5 bg-sidebar px-4 py-1.5 text-left text-[13px] hover:bg-white/[0.03]"
    >
      {locked ? <Lock size={14} className="shrink-0 text-muted" /> : <Pin size={14} className="shrink-0 text-amber" />}
      <span className="min-w-0 flex-1 truncate text-ink-2">
        <span className="font-medium text-ink">{locked ? "Điều khoản đã khóa" : "Điều khoản chưa khóa"}</span>
        {" · "}
        {ws.milestones.length} milestone · {usdc(total)} · {ws.feeTier === "BASIC" ? "BASIC 7%" : "ADVANCED 10%"}
        <span className="text-muted"> · Demo: ký quỹ, giải ngân và phí đều là mô phỏng</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-muted" />
    </button>
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
