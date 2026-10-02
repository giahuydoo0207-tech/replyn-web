"use client";

import { ShieldCheck, X } from "lucide-react";
import { milestonesNeedingMe, openDisputes, tabOrder } from "@/lib/protection";
import type { PanelTab } from "@/lib/reducer";
import { useActiveChat, useMe, useStore } from "@/lib/store";
import { cx, IconButton } from "../ui";
import { DisputeTab } from "./DisputeTab";
import { EvidenceTab } from "./EvidenceTab";
import { FilesTab } from "./FilesTab";
import { MilestonesTab } from "./MilestonesTab";
import { StatusHeader } from "./StatusHeader";
import { TermsTab } from "./TermsTab";

const LABEL: Record<PanelTab, string> = {
  terms: "Điều khoản",
  milestones: "Milestones",
  files: "Files",
  evidence: "Bằng chứng",
  dispute: "Tranh chấp",
};

/**
 * Panel "Bảo vệ dự án": Status Header cố định + 5 tab chi tiết.
 * Thứ tự tab và badge đổi theo ngữ cảnh (kiểu context panel của Telegram).
 */
export function RightPanel({ className }: { className?: string }) {
  const { state, dispatch } = useStore();
  const { conv, ws } = useActiveChat();
  const meId = useMe();
  const tab = state.ui.panelTab;

  return (
    <aside aria-label="Bảo vệ dự án" className={cx("flex h-full w-full flex-col border-l border-white/5 bg-sidebar", className)}>
      <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-white/5 px-4">
        <ShieldCheck size={19} className="text-ink-2" />
        <h2 className="flex-1 truncate text-[16px] font-semibold">Bảo vệ dự án</h2>
        <IconButton label="Đóng Bảo vệ dự án" onClick={() => dispatch({ type: "SET_PANEL", open: false })}>
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
          <StatusHeader ws={ws} />

          <div role="tablist" aria-label="Chi tiết bảo vệ dự án" className="flex shrink-0 border-b border-white/5 px-2">
            {tabOrder(ws).map((t) => {
              const active = tab === t;
              const disputes = t === "dispute" ? openDisputes(ws).length : 0;
              const pending =
                t === "milestones" ? milestonesNeedingMe(ws, meId).length : t === "terms" && !ws.termsLockedAt ? 1 : 0;
              return (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => dispatch({ type: "SET_PANEL", tab: t })}
                  className={cx(
                    "relative flex flex-auto items-center justify-center gap-1 whitespace-nowrap px-1 py-2.5 text-[13px] transition-colors",
                    active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {LABEL[t]}
                  {disputes > 0 && (
                    <span className="min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white" aria-label={`${disputes} tranh chấp đang mở`}>
                      {disputes}
                    </span>
                  )}
                  {pending > 0 && <span className="size-1.5 rounded-full bg-amber" aria-label="cần xử lý" />}
                  {active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-yellow" />}
                </button>
              );
            })}
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
