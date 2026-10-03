"use client";

import { BellOff, CheckCheck, Megaphone, Menu, MessageSquarePlus, MoreVertical, Pin, Search, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { listTime } from "@/lib/format";
import { previewOf } from "@/lib/preview";
import { SYSTEM_ID, visibleTo, workspaceHeadline, type ListFilter } from "@/lib/reducer";
import { milestonesNeedingMe, openDisputes } from "@/lib/protection";
import { useMe, useStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { Avatar, cx, IconButton, StatusBadge } from "./ui";
import { NavigationMenu } from "./NavigationMenu";

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "unread", label: "Chưa đọc" },
  { id: "replyn", label: "Dự án" },
  { id: "tasks", label: "Việc cần làm" },
];

function KindIcon({ conv }: { conv: Conversation }) {
  if (conv.kind === "replyn") return <ShieldCheck size={15} className="shrink-0 text-ink-2" aria-label="Replyn workspace" />;
  if (conv.kind === "group") return <Users size={15} className="shrink-0 text-ink-2" aria-label="Nhóm" />;
  if (conv.kind === "channel") return <Megaphone size={15} className="shrink-0 text-ink-2" aria-label="Kênh" />;
  return null;
}

export function ChatList({ onOpen }: { onOpen?: () => void }) {
  const { state, dispatch } = useStore();
  const meId = useMe();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { filter, activeChatId } = state.ui;

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pinnedFirst = [...state.order].sort(
      (a, b) => Number(!!state.conversations[b].pinned) - Number(!!state.conversations[a].pinned),
    );
    return pinnedFirst.filter((id) => {
      if (!visibleTo(state, id)) return false;
      const c = state.conversations[id];
      const ws = c.workspaceId ? state.workspaces[c.workspaceId] : undefined;
      const msgs = state.messages[id] ?? [];
      if (needle) {
        const hay = (c.title + " " + msgs.map((m) => m.text ?? "").join(" ")).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      switch (filter) {
        case "unread":
          return c.unread > 0;
        case "replyn":
          return c.kind === "replyn";
        case "tasks":
          return !!ws && (milestonesNeedingMe(ws, meId).length > 0 || openDisputes(ws).length > 0 || !ws.termsLockedAt);
        case "files":
          return msgs.some((m) => m.kind === "file" || m.kind === "submission");
        case "review":
          return !!ws?.milestones.some((m) => m.status === "in_review");
        case "dispute":
          return !!ws?.milestones.some((m) => m.status === "disputed");
        default:
          return true;
      }
    });
  }, [state, q, filter, meId]);

  const count = (f: ListFilter) =>
    f === "unread" ? state.order.filter((id) => visibleTo(state, id) && state.conversations[id].unread > 0).length : 0;

  return (
    <section aria-label="Danh sách trò chuyện" className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <IconButton label="Menu Replyn" className="md:hidden" onClick={() => setMenuOpen(true)}><Menu size={22} /></IconButton>
        <h1 className="text-[26px] font-bold tracking-tight">Replyn</h1>
        <div className="flex gap-1">
          <IconButton label="Trò chuyện mới">
            <MessageSquarePlus size={20} />
          </IconButton>
          <IconButton label="Tùy chọn">
            <MoreVertical size={20} />
          </IconButton>
        </div>
      </header>
      {menuOpen && <NavigationMenu onClose={() => setMenuOpen(false)} />}

      <div className="px-4">
        <label className="flex h-10 items-center gap-3 rounded-full bg-white/6 px-4 text-ink-2 focus-within:ring-1 focus-within:ring-white/25">
          <Search size={18} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm dự án, người hoặc tin nhắn"
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
            aria-label="Tìm kiếm"
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]" role="tablist" aria-label="Bộ lọc">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const n = count(f.id);
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => dispatch({ type: "SET_FILTER", filter: f.id })}
              className={cx(
                "shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                active ? "bg-white/12 text-ink" : "bg-white/5 text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
              {n > 0 && <span className="ml-1 opacity-80">{n}</span>}
            </button>
          );
        })}
      </div>

      <ul className="thin-scroll flex-1 overflow-y-auto px-2 pb-3">
        {items.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-ink-2">Không có cuộc trò chuyện nào khớp bộ lọc.</li>
        )}
        {items.map((id) => {
          const c = state.conversations[id];
          const msgs = state.messages[id] ?? [];
          const last = msgs.at(-1);
          const ws = c.workspaceId ? state.workspaces[c.workspaceId] : undefined;
          const headline = ws ? workspaceHeadline(ws) : null;
          const active = id === activeChatId;
          const mine = last?.senderId === meId;
          const showSender =
            last && !mine && last.senderId !== SYSTEM_ID && (c.kind === "group" || c.kind === "replyn");
          const sender = last ? state.users[last.senderId] : undefined;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "SELECT_CHAT", chatId: id });
                  onOpen?.();
                }}
                aria-current={active ? "true" : undefined}
                className={cx(
                  "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  active ? "bg-active" : "hover:bg-hover",
                )}
              >
                <Avatar {...c.avatar} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <KindIcon conv={c} />
                    <span className="truncate text-[15px] font-medium">{c.title}</span>
                    <span
                      className={cx(
                        "ml-auto shrink-0 pl-2 text-xs",
                        c.unread > 0 ? "font-medium text-ink" : "text-muted",
                      )}
                    >
                      {last && listTime(last.at, state.clock)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {mine && <CheckCheck size={16} className="shrink-0 text-[#53bdeb]" aria-label="Đã xem" />}
                    <p className="truncate text-[14px] text-muted">
                      {showSender && sender && <span style={{ color: sender.color }}>{sender.short}: </span>}
                      {last ? previewOf(state, last) : c.subtitle}
                    </p>
                    <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
                      {c.muted && <BellOff size={14} className="text-muted" aria-label="Đã tắt thông báo" />}
                      {c.pinned && !c.unread && <Pin size={14} className="rotate-45 text-muted" aria-label="Đã ghim" />}
                      {c.unread > 0 && (
                        <span
                          className={cx(
                            "min-w-[22px] rounded-full px-1.5 text-center text-xs font-bold leading-[22px]",
                            c.muted ? "bg-white/12 text-ink-2" : "bg-ink text-app",
                          )}
                        >
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </div>
                  {headline && (
                    <div className="mt-1">
                      <StatusBadge status={headline} />
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
