"use client";

import { Briefcase, Clapperboard, FolderOpen, MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { initials, visibleTo } from "@/lib/reducer";
import { buildScene, initialState, SCENES } from "@/lib/seed";
import { useMe, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Avatar, cx, ReplynMark } from "./ui";

function RailButton({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "group relative flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-yellow",
        active ? "bg-yellow/12 text-yellow" : "text-ink-2 hover:bg-white/6 hover:text-ink",
      )}
    >
      {active && <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r bg-yellow" />}
      {children}
      <span className="leading-none">{label}</span>
      {!!badge && (
        <span className="absolute right-1 top-0.5 min-w-5 rounded-full bg-yellow px-1.5 text-[11px] font-bold leading-5 text-[#0B0D0A] ring-2 ring-rail">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export function Rail() {
  const { state, dispatch } = useStore();
  const meId = useMe();
  const user = state.users[meId];
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const unread = state.order
    .filter((id) => visibleTo(state, id) && !state.conversations[id].muted)
    .reduce((a, id) => a + state.conversations[id].unread, 0);

  const { filter, panelTab, panelOpen } = state.ui;
  const setRole = (role: Role) => dispatch({ type: "SET_ROLE", role });

  return (
    <nav
      aria-label="Điều hướng chính"
      className="relative z-30 flex w-[72px] shrink-0 flex-col items-center gap-1.5 border-r border-white/5 bg-rail py-3"
    >
      <div className="mb-2" title="Replyn">
        <ReplynMark size={40} />
      </div>
      <RailButton
        label="Chats"
        active={filter !== "replyn"}
        badge={unread}
        onClick={() => dispatch({ type: "SET_FILTER", filter: "all" })}
      >
        <MessageCircle size={22} />
      </RailButton>
      <RailButton
        label="Replyn"
        active={filter === "replyn"}
        onClick={() => dispatch({ type: "SET_FILTER", filter: "replyn" })}
      >
        <Briefcase size={22} />
      </RailButton>
      <RailButton
        label="Files"
        active={panelOpen && panelTab === "files"}
        onClick={() => dispatch({ type: "SET_PANEL", tab: "files", open: true })}
      >
        <FolderOpen size={22} />
      </RailButton>
      <RailButton
        label="Bằng chứng"
        active={panelOpen && panelTab === "evidence"}
        onClick={() => dispatch({ type: "SET_PANEL", tab: "evidence", open: true })}
      >
        <ShieldCheck size={22} />
      </RailButton>

      <div className="mt-auto flex flex-col items-center gap-2" ref={menuRef}>
        <RailButton label="Demo" active={menu} onClick={() => setMenu((v) => !v)}>
          <Clapperboard size={22} />
        </RailButton>
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-yellow"
          aria-label={`Hồ sơ: ${user.name}`}
          title={`${user.name} · ${state.role === "business" ? "Business" : "Freelancer"}`}
        >
          <Avatar initials={initials(user.name)} bg="#2A2103" fg={user.color} size={40} ring />
        </button>

        {menu && (
          <div className="msg-in absolute bottom-3 left-[80px] w-80 rounded-2xl bg-panel p-3 shadow-2xl ring-1 ring-line">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Xem với vai trò</p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-rail p-1">
              {(["business", "freelancer"] as Role[]).map((r) => {
                const u = state.users[state.roleUser[r]];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cx(
                      "rounded-lg px-2 py-2 text-left transition-colors",
                      state.role === r ? "bg-yellow text-[#0B0D0A]" : "text-ink-2 hover:bg-white/6",
                    )}
                  >
                    <span className="block text-sm font-semibold">{r === "business" ? "Business" : "Freelancer"}</span>
                    <span className="block truncate text-xs opacity-80">{u.name}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Nhảy tới cảnh demo</p>
            <ol className="mt-1.5 space-y-0.5">
              {SCENES.map((sc) => (
                <li key={sc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "REPLACE", state: { ...buildScene(sc.id), role: state.role } });
                      setMenu(false);
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/6"
                  >
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-yellow/15 text-xs font-bold text-yellow">
                      {sc.id}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{sc.title}</span>
                      <span className="block text-xs text-ink-2">{sc.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "REPLACE", state: initialState() });
                setMenu(false);
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-white/6 hover:text-ink"
            >
              <RotateCcw size={16} /> Đặt lại demo
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
