"use client";

import { ShieldCheck, X } from "lucide-react";
import type { PanelTab } from "@/lib/reducer";
import { useActiveChat, useStore } from "@/lib/store";
import { cx, IconButton } from "../ui";
import { DisputeTab } from "./DisputeTab";
import { EvidenceTab } from "./EvidenceTab";
import { FilesTab } from "./FilesTab";
import { MilestonesTab } from "./MilestonesTab";
import { OverviewTab } from "./OverviewTab";
import { TermsTab } from "./TermsTab";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "terms", label: "Điều khoản" },
  { id: "milestones", label: "Milestones" },
  { id: "files", label: "Files" },
  { id: "evidence", label: "Bằng chứng" },
  { id: "dispute", label: "Tranh chấp" },
];

/** Panel "Replyn Protection": mọi cơ chế bảo vệ nằm ở đây, chat giữa chỉ còn hội thoại */
export function RightPanel({ className }: { className?: string }) {
  const { state, dispatch } = useStore();
  const { conv, ws } = useActiveChat();
  const tab = state.ui.panelTab;

  return (
    <aside aria-label="Replyn Protection" className={cx("flex h-full w-full flex-col border-l border-white/5 bg-sidebar", className)}>
      <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-white/5 px-4">
        <ShieldCheck size={19} className="text-ink-2" />
        <h2 className="flex-1 truncate text-[16px] font-semibold">Replyn Protection</h2>
        <IconButton label="Đóng Replyn Protection" onClick={() => dispatch({ type: "SET_PANEL", open: false })}>
          <X size={20} />
        </IconButton>
      </header>

      {!ws || !conv ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <ShieldCheck size={32} className="text-muted" />
          <p className="mt-3 font-medium">Chưa phải workspace Replyn</p>
          <p className="mt-1 text-sm text-ink-2">
            Điều khoản, milestone, file và bằng chứng dự án chỉ có trong workspace Replyn.
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Replyn Protection" className="grid shrink-0 grid-cols-3 gap-1 px-3 pt-3">
            {TABS.map((t) => {
              const active = tab === t.id;
              const openDispute = t.id === "dispute" && ws.disputes.some((d) => d.status !== "resolved");
              return (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => dispatch({ type: "SET_PANEL", tab: t.id })}
                  className={cx(
                    "relative rounded-full px-2 py-1.5 text-[13px] transition-colors",
                    active ? "bg-white/12 font-semibold text-ink" : "text-ink-2 hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {t.label}
                  {openDispute && <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-danger" aria-label="đang có tranh chấp" />}
                </button>
              );
            })}
          </div>
          <div className="mx-4 mt-3 h-px shrink-0 bg-white/5" />

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "overview" && <OverviewTab ws={ws} />}
            {tab === "terms" && <TermsTab ws={ws} />}
            {tab === "milestones" && <MilestonesTab ws={ws} />}
            {tab === "files" && <FilesTab ws={ws} />}
            {tab === "evidence" && <EvidenceTab ws={ws} />}
            {tab === "dispute" && <DisputeTab ws={ws} />}
          </div>
        </>
      )}
    </aside>
  );
}
