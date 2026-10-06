"use client";

import { ArrowLeft, LibraryBig, MessageCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { milestonesNeedingMe, openDisputes } from "@/lib/protection";
import { useActiveChat, useMe, useStore } from "@/lib/store";
import { PROJECT_TOOLS } from "../projectTools";
import { Avatar, cx, IconButton } from "../ui";
import { ArchiveTab } from "./ArchiveTab";
import { DisputeTab } from "./DisputeTab";
import { EvidenceTab } from "./EvidenceTab";
import { FilesTab } from "./FilesTab";
import { MilestonesTab } from "./MilestonesTab";
import { StatusHeader } from "./StatusHeader";
import { TermsTab } from "./TermsTab";

/** Công cụ dự án mở trong chính vùng hội thoại, giữ nguyên danh sách chat bên trái. */
export function RightPanel({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useStore();
  const { conv, ws } = useActiveChat();
  const meId = useMe();
  const tab = state.ui.panelTab;
  const activeTabRef = useRef<HTMLButtonElement>(null);
  // Tab đang mở (vd. Lưu trữ ở cuối) luôn nằm trong vùng nhìn thấy trên màn hẹp.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);
  const current = PROJECT_TOOLS.find((item) => item.tab === tab) ?? PROJECT_TOOLS.find((item) => item.tab === "milestones")!;

  if (!conv || !ws) {
    return (
      <section aria-label="Công cụ dự án" className="flex h-full flex-1 flex-col items-center justify-center bg-app px-6 text-center">
        <MessageCircle size={34} className="text-muted" />
        <h1 className="mt-4 text-lg font-semibold">Chọn một dự án trước</h1>
        <button onClick={onBack} className="mt-3 text-sm text-link hover:underline">Quay lại cuộc trò chuyện</button>
      </section>
    );
  }

  return (
    <section aria-label={`Công cụ dự án: ${ws.title}`} className="flex h-full min-w-0 flex-1 flex-col bg-app">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-sidebar px-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-2 hover:bg-white/8 hover:text-ink sm:px-3"
          aria-label="Quay lại cuộc trò chuyện"
        >
          <ArrowLeft size={19} />
          <span className="hidden sm:inline">Về chat</span>
        </button>
        <Avatar {...conv.avatar} size={38} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold">{ws.title}</h1>
          <p className="truncate text-[13px] text-muted">Công cụ dự án · {current.label}</p>
        </div>
        <span className="hidden rounded bg-white/6 px-2 py-1 text-xs text-muted sm:inline">Mô phỏng</span>
        {/* Cùng icon bìa ở header chat: bấm lại để gập hồ sơ, quay về cuộc trò chuyện. */}
        <IconButton label="Đóng hồ sơ dự án" aria-pressed active onClick={onBack}><LibraryBig size={20} /></IconButton>
        <IconButton label="Đóng công cụ dự án" onClick={onBack}><X size={20} /></IconButton>
      </header>

      <nav aria-label="Các mục dự án" className="flex shrink-0 overflow-x-auto border-b border-line bg-sidebar px-2 [scrollbar-width:none] sm:px-4">
        {PROJECT_TOOLS.map((item) => {
          const count = item.tab === "dispute" ? openDisputes(ws).length : item.tab === "milestones" ? milestonesNeedingMe(ws, meId).length : 0;
          return (
            <button
              key={item.tab}
              ref={tab === item.tab ? activeTabRef : undefined}
              type="button"
              aria-current={tab === item.tab ? "page" : undefined}
              onClick={() => dispatch({ type: "SET_PANEL", tab: item.tab, open: true })}
              className={cx(
                "relative flex h-12 shrink-0 items-center gap-2 px-3 text-sm text-ink-2 hover:text-ink",
                tab === item.tab && "font-semibold text-ink",
              )}
            >
              <item.icon size={17} />
              {item.label}
              {count > 0 && <span className={cx("min-w-5 rounded-full px-1 text-center text-[11px]", item.tab === "dispute" ? "bg-danger/15 text-danger" : "bg-white/10")}>{count}</span>}
              {tab === item.tab && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-yellow" />}
            </button>
          );
        })}
      </nav>

      <div className="thin-scroll min-h-0 min-w-0 flex-1 overflow-y-auto" key={`${ws.id}-${tab}`}>
        <div className="mx-auto max-w-[900px] px-4 py-5 sm:px-7 sm:py-7">
          <StatusHeader ws={ws} />
          <div className="mb-5 mt-6 flex items-start gap-3 border-b border-line pb-4">
            <current.icon size={22} className="mt-0.5 shrink-0 text-ink-2" />
            <div><h2 className="text-lg font-semibold">{current.label}</h2><p className="mt-0.5 text-sm text-muted">{current.hint}</p></div>
          </div>
          {ws.agreement && (tab === "milestones" || tab === "files" || tab === "dispute") && (
            // Workspace thật: thỏa thuận đến từ Nova, còn ký quỹ, nộp sản phẩm và hỗ trợ chưa đồng bộ giữa hai bên.
            <p className="-mt-2 mb-4 rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-ink-2">
              Các thao tác trong workspace là mô phỏng và chỉ lưu trên trình duyệt này.
            </p>
          )}
          {tab === "terms" && <TermsTab ws={ws} />}
          {tab === "milestones" && <MilestonesTab ws={ws} />}
          {tab === "files" && <FilesTab ws={ws} />}
          {tab === "evidence" && <EvidenceTab ws={ws} />}
          {tab === "dispute" && <DisputeTab ws={ws} />}
          {tab === "archive" && <ArchiveTab ws={ws} />}
          <button onClick={onBack} className="mt-7 inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink"><MessageCircle size={16} />Về cuộc trò chuyện</button>
        </div>
      </div>
    </section>
  );
}
