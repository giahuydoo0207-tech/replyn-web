"use client";

import { AlertTriangle, FolderOpen, ListChecks, ShieldCheck, X } from "lucide-react";
import { usdc } from "@/lib/fees";
import type { PanelTab } from "@/lib/reducer";
import { useActiveChat, useStore } from "@/lib/store";
import { Avatar, Badge, cx, IconButton } from "../ui";
import { DisputeTab } from "./DisputeTab";
import { EvidenceTab } from "./EvidenceTab";
import { FilesTab } from "./FilesTab";
import { MilestonesTab } from "./MilestonesTab";

const TABS: { id: PanelTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "milestones", label: "Milestones", icon: ListChecks },
  { id: "evidence", label: "Bằng chứng dự án", icon: ShieldCheck },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "dispute", label: "Tranh chấp", icon: AlertTriangle },
];

export function RightPanel({ className }: { className?: string }) {
  const { state, dispatch } = useStore();
  const { conv, ws } = useActiveChat();
  const tab = state.ui.panelTab;

  return (
    <aside
      aria-label="Chi tiết workspace"
      className={cx("flex h-full w-full flex-col border-l border-white/5 bg-sidebar", className)}
    >
      <header className="flex h-[64px] shrink-0 items-center gap-2 border-b border-white/5 px-4">
        <h2 className="flex-1 truncate text-[17px] font-bold">{ws ? "Chi tiết workspace" : "Chi tiết"}</h2>
        <IconButton label="Đóng bảng chi tiết" onClick={() => dispatch({ type: "SET_PANEL", open: false })}>
          <X size={20} />
        </IconButton>
      </header>

      {!ws || !conv ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <ShieldCheck size={36} className="text-yellow" />
          <p className="mt-3 font-semibold">Chưa phải workspace Replyn</p>
          <p className="mt-1 text-sm text-ink-2">
            Milestones, files và Bằng chứng dự án chỉ có trong workspace Replyn. Mở một workspace hoặc gửi “Đề xuất Replyn” từ Nova Chat.
          </p>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-4 pt-3">
            <div className="flex items-center gap-3 rounded-2xl bg-panel p-3 ring-1 ring-line">
              <Avatar {...conv.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ws.title}</p>
                <p className="truncate text-xs text-ink-2">
                  {state.users[ws.businessId].name} · {state.users[ws.freelancerId].name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-yellow">{usdc(ws.milestones.reduce((a, m) => a + m.amount, 0))}</p>
                <Badge tone="muted" className="mt-0.5">
                  {ws.feeTier}
                </Badge>
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Mục chi tiết" className="grid shrink-0 grid-cols-4 gap-1 px-4 pt-3">
            {TABS.map((t) => {
              const active = tab === t.id;
              const hasDispute = t.id === "dispute" && ws.disputes.some((d) => d.status !== "resolved");
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => dispatch({ type: "SET_PANEL", tab: t.id })}
                  className={cx(
                    "relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[12px] font-semibold leading-tight transition-colors",
                    active ? "bg-yellow/12 text-yellow" : "text-ink-2 hover:bg-white/5 hover:text-ink",
                  )}
                >
                  <Icon size={18} />
                  <span className="text-center">{t.id === "evidence" ? "Bằng chứng" : t.label}</span>
                  {hasDispute && <span className="absolute right-2 top-1.5 size-2 rounded-full bg-danger" />}
                  {active && <span className="absolute inset-x-3 -bottom-[5px] h-[3px] rounded-full bg-yellow" />}
                </button>
              );
            })}
          </div>
          <div className="mx-4 mt-[5px] h-px shrink-0 bg-line" />

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "milestones" && <MilestonesTab ws={ws} />}
            {tab === "evidence" && <EvidenceTab ws={ws} />}
            {tab === "files" && <FilesTab ws={ws} />}
            {tab === "dispute" && <DisputeTab ws={ws} />}
          </div>
        </>
      )}
    </aside>
  );
}
