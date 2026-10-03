"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  FilePlus2,
  FileUp,
  Gavel,
  Lock,
  PencilLine,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ComponentType } from "react";
import { ddmmyyyy, hhmm, shortHash } from "@/lib/format";
import { NOVA_TEAM_ID, SYSTEM_ID } from "@/lib/reducer";
import { jumpToMessage, useStore } from "@/lib/store";
import type { EvidenceType, Workspace } from "@/lib/types";
import { cx } from "../ui";

const ICON: Record<EvidenceType, ComponentType<{ size?: number }>> = {
  workspace_created: FilePlus2,
  terms_locked: Lock,
  funded: Banknote,
  submitted: FileUp,
  revision: PencilLine,
  resubmitted: RefreshCw,
  accepted: BadgeCheck,
  dispute_opened: AlertTriangle,
  nova_review: Search,
  decision: Gavel,
  released: Banknote,
};

/** Nhật ký minh bạch giúp hai bên đối chiếu toàn bộ diễn biến dự án. */
export function EvidenceTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const actorLabel = (id: string) => {
    if (id === SYSTEM_ID) return "Replyn";
    if (id === NOVA_TEAM_ID) return "Đội ngũ Nova";
    return `${state.users[id]?.name} · ${id === ws.businessId ? "Business" : "Freelancer"}`;
  };

  return (
    <div>
      <div className="rounded-xl bg-panel p-4">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold">
          <Lock size={16} className="text-ink-2" /> Nhật ký dự án
        </h3>
        <p className="mt-1 text-[13px] text-ink-2">
          Mọi hoạt động được ghi theo thời gian, gắn với tin nhắn, sản phẩm và giai đoạn liên quan. Không bên nào tự sửa hoặc xóa được.
        </p>
        <p className="mt-2 text-xs text-muted">
          {ws.evidence.length} hoạt động · {ws.attachments.length} sản phẩm có mã đối chiếu · {ws.disputes.length} yêu cầu hỗ trợ
        </p>
      </div>

      <ol className="relative mt-4">
        {ws.evidence.map((e, i) => {
          const Icon = ICON[e.type];
          const file = e.attachmentId ? ws.attachments.find((a) => a.id === e.attachmentId) : undefined;
          const last = i === ws.evidence.length - 1;
          const msIdx = e.milestoneId ? ws.milestones.findIndex((m) => m.id === e.milestoneId) + 1 : 0;
          const danger = e.type === "dispute_opened";
          return (
            <li key={e.id} id={`ev-${e.id}`} className={cx("relative flex gap-3 rounded-lg pb-4", state.ui.flashId === e.id && "flash")}>
              {!last && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-white/8" aria-hidden />}
              <span
                className={cx(
                  "z-10 grid size-8 shrink-0 place-items-center rounded-full bg-elevated",
                  danger ? "text-danger" : "text-ink-2",
                )}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium leading-snug">{e.title}</p>
                  <time className="shrink-0 text-[11px] tabular-nums text-muted">
                    {ddmmyyyy(e.at).slice(0, 5)} {hhmm(e.at)}
                  </time>
                </div>
                <p className="text-[12px] text-muted">
                  {actorLabel(e.actorId)}
                  {msIdx > 0 && ` · M${msIdx}`}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-2">{e.description}</p>
                {file && (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted" title={file.hash}>
                    {file.name} · sha256 {shortHash(file.hash)}
                  </p>
                )}
                {e.messageId && (
                  <button
                    type="button"
                    onClick={() => jumpToMessage(dispatch, e.messageId!)}
                    className="mt-0.5 text-[12px] text-ink-2 underline decoration-white/20 underline-offset-2 hover:text-ink"
                  >
                    Xem tin nhắn liên quan
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
