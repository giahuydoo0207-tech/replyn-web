"use client";

import {
  Briefcase,
  Clapperboard,
  Files,
  ListTodo,
  Menu,
  MessageCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { initials, visibleTo } from "@/lib/reducer";
import { buildScene, initialState, SCENES } from "@/lib/seed";
import { useMe, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Avatar, cx, ReplynMark } from "./ui";
import { NavigationMenu } from "./NavigationMenu";

const COLLAPSED = 64;
const EXPANDED = 224;

/**
 * Sidebar thu/phóng: mặc định chỉ icon (64px). Hover thì giãn ra dạng overlay,
 * Nút menu mở điều hướng chức năng độc lập. Label ẩn bằng opacity + pointer-events,
 * không dùng display:none để animation mượt.
 */
export function Rail() {
  const { state, dispatch } = useStore();
  const meId = useMe();
  const user = state.users[meId];
  const [hovered, setHovered] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
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

  const visible = state.order.filter((id) => visibleTo(state, id));
  const unread = visible.filter((id) => !state.conversations[id].muted).reduce((a, id) => a + state.conversations[id].unread, 0);
  const tasks = visible.filter((id) => {
    const w = state.conversations[id].workspaceId;
    return w && state.workspaces[w].milestones.some((m) => ["awaiting_funding", "in_review", "ready_to_release", "disputed"].includes(m.status));
  }).length;

  const { filter, panelOpen } = state.ui;
  const expanded = hovered && !suppressHover;

  const items: { id: string; label: string; icon: ReactNode; active: boolean; badge?: number; danger?: boolean; run: () => void }[] = [
    {
      id: "chats",
      label: "Tin nhắn",
      icon: <MessageCircle size={21} />,
      active: !panelOpen && (filter === "all" || filter === "unread" || filter === "review"),
      badge: unread,
      run: () => { dispatch({ type: "SET_FILTER", filter: "all" }); dispatch({ type: "SET_PANEL", open: false }); },
    },
    {
      id: "replyn",
      label: "Dự án",
      icon: <Briefcase size={21} />,
      active: !panelOpen && filter === "replyn",
      run: () => { dispatch({ type: "SET_FILTER", filter: "replyn" }); dispatch({ type: "SET_PANEL", open: false }); },
    },
    {
      id: "tasks",
      label: "Việc cần làm",
      icon: <ListTodo size={21} />,
      active: !panelOpen && filter === "tasks",
      badge: tasks,
      run: () => { dispatch({ type: "SET_FILTER", filter: "tasks" }); dispatch({ type: "SET_PANEL", open: false }); },
    },
    {
      id: "files",
      label: "Tệp",
      icon: <Files size={21} />,
      active: !panelOpen && filter === "files",
      run: () => { dispatch({ type: "SET_FILTER", filter: "files" }); dispatch({ type: "SET_PANEL", open: false }); },
    },
  ];

  return (
    <div
      className="relative z-30 h-full shrink-0 transition-[width] duration-300 ease-out"
      style={{ width: COLLAPSED }}
    >
      <nav
        aria-label="Điều hướng chính"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setSuppressHover(false);
        }}
        className={cx(
          "group/rail absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-white/5 bg-rail py-3 transition-[width,box-shadow] duration-300 ease-out",
          expanded ? "w-[224px] shadow-[8px_0_24px_rgb(0_0_0/0.45)]" : "w-16",
        )}
      >
        {/* hàng đầu: ☰ + thương hiệu */}
        <div className="mb-2 flex h-11 items-center px-2">
          <button
            type="button"
            onClick={() => setNavigationOpen(true)}
            aria-label="Menu Replyn"
            aria-haspopup="dialog"
            aria-expanded={navigationOpen}
            title="Menu Replyn"
            className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-white/6 hover:text-ink focus-visible:outline-2 focus-visible:outline-white/40"
          >
            <Menu size={22} />
          </button>
          <Label pinned={expanded} className="flex min-w-0 flex-1 items-center gap-2 pl-1">
            <ReplynMark size={26} />
            <span className="text-[17px] font-bold">Replyn</span>
          </Label>
          <button
            type="button"
            aria-label="Đóng thanh bên"
            title="Đóng thanh bên"
            onClick={() => setSuppressHover(true)}
            className={cx(
              "grid size-9 shrink-0 place-items-center rounded-full text-ink-2 transition-[opacity,background-color] hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-white/40",
              expanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <X size={19} />
          </button>
        </div>

        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id}>
              <RailItem label={it.label} icon={it.icon} active={it.active} badge={it.badge} danger={it.danger} run={it.run} pinned={expanded} />
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-1" ref={menuRef}>
          <RailItem
            label="Demo"
            icon={<Clapperboard size={21} />}
            active={menu}
            pinned={expanded}
            run={() => setMenu((v) => !v)}
          />
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className="mx-2 flex h-12 items-center rounded-xl hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-white/40"
            aria-label={`Hồ sơ: ${user.name}`}
          >
            <span className="grid w-12 shrink-0 place-items-center">
              <Avatar initials={initials(user.name)} bg="#233138" fg={user.color} size={34} ring />
            </span>
            <Label pinned={expanded} className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block text-xs text-muted">{state.role === "business" ? "Business" : "Freelancer"}</span>
            </Label>
          </button>

          {menu && (
            <DemoMenu
              // menu là con của nav nên khi trỏ chuột vào menu, rail vẫn ở trạng thái mở rộng
              left={EXPANDED + 8}
              onClose={() => setMenu(false)}
              role={state.role}
              setRole={(r: Role) => dispatch({ type: "SET_ROLE", role: r })}
            />
          )}
        </div>
      </nav>
      {navigationOpen && <NavigationMenu onClose={() => setNavigationOpen(false)} />}
    </div>
  );
}

function Label({ pinned, className, children }: { pinned: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "whitespace-nowrap transition-opacity duration-300",
        pinned
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0 group-hover/rail:pointer-events-auto group-hover/rail:opacity-100 group-hover/rail:delay-100 group-has-[:focus-visible]/rail:opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

function RailItem({
  label,
  icon,
  active,
  badge,
  danger,
  pinned,
  run,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
  danger?: boolean;
  pinned: boolean;
  run: () => void;
}) {
  return (
    <button
      type="button"
      onClick={run}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cx(
        "relative mx-2 flex h-12 w-[calc(100%-16px)] items-center rounded-xl text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-white/40",
        active ? "bg-active text-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      <span className="relative grid w-12 shrink-0 place-items-center">
        {icon}
        {!!badge && (
          <span className={cx("absolute -top-1.5 right-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold leading-[18px] ring-2 ring-rail", danger ? "bg-danger text-white" : "bg-ink text-app")}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <Label pinned={pinned} className={cx(active && "font-semibold")}>
        {label}
      </Label>
      {active && <span className="absolute right-3 size-1.5 rounded-full bg-yellow" aria-hidden />}
    </button>
  );
}

function DemoMenu({
  left,
  onClose,
  role,
  setRole,
}: {
  left: number;
  onClose: () => void;
  role: Role;
  setRole: (r: Role) => void;
}) {
  const { state, dispatch } = useStore();
  return (
    <div
      className="msg-in fixed bottom-3 z-50 w-80 rounded-2xl bg-panel p-3 shadow-2xl ring-1 ring-line"
      style={{ left }}
    >
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
                role === r ? "bg-white/12 text-ink" : "text-ink-2 hover:bg-white/6",
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
                dispatch({ type: "REPLACE", state: { ...buildScene(sc.id), role } });
                onClose();
              }}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/6"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-bold text-ink-2">
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
          onClose();
        }}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-white/6 hover:text-ink"
      >
        <RotateCcw size={16} /> Đặt lại demo
      </button>
    </div>
  );
}
