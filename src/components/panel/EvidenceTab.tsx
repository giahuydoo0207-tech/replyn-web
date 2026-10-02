"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CornerDownRight,
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

const META: Record<EvidenceType, { icon: ComponentType<{ size?: number }>; tone: string }> = {
  terms_locked: { icon: Lock, tone: "bg-yellow/15 text-yellow ring-yellow/40" },
  funded: { icon: Banknote, tone: "bg-success/15 text-success ring-success/40" },
  submitted: { icon: FileUp, tone: "bg-cyan/15 text-cyan ring-cyan/40" },
  revision: { icon: PencilLine, tone: "bg-amber/15 text-amber ring-amber/40" },
  resubmitted: { icon: RefreshCw, tone: "bg-cyan/15 text-cyan ring-cyan/40" },
  accepted: { icon: BadgeCheck, tone: "bg-success/15 text-success ring-success/40" },
  dispute_opened: { icon: AlertTriangle, tone: "bg-danger/15 text-danger ring-danger/40" },
  nova_review: { icon: Search, tone: "bg-cyan/15 text-cyan ring-cyan/40" },
  decision: { icon: Gavel, tone: "bg-yellow/15 text-yellow ring-yellow/40" },
  released: { icon: Banknote, tone: "bg-success/15 text-success ring-success/40" },
};

export function EvidenceTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const actorLabel = (id: string) => {
    if (id === SYSTEM_ID) return "Replyn";
    if (id === NOVA_TEAM_ID) return "Đội ngũ Nova";
    const role = id === ws.businessId ? "Business" : "Freelancer";
    return `${state.users[id]?.name} · ${role}`;
  };

  return (
    <div>
      <div className="rounded-2xl bg-[#1c1704] p-3.5 ring-1 ring-yellow/20">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-yellow">
          <Lock size={17} /> Bằng chứng dự án
        </h3>
        <p className="mt-1 text-[13px] text-[#e3d39b]">
          Mọi sự kiện được ghi theo thời gian, gắn với tin nhắn, file và milestone. Không bên nào sửa hoặc xóa được.
        </p>
        <p className="mt-2 text-xs text-ink-2">
          {ws.evidence.length} sự kiện · {ws.attachments.length} file có hash · {ws.disputes.length} tranh chấp
        </p>
      </div>

      <ol className="relative mt-4 space-y-0">
        {ws.evidence.map((e, i) => {
          const { icon: Icon, tone } = META[e.type];
          const file = e.attachmentId ? ws.attachments.find((a) => a.id === e.attachmentId) : undefined;
          const lastItem = i === ws.evidence.length - 1;
          const msIdx = e.milestoneId ? ws.milestones.findIndex((m) => m.id === e.milestoneId) + 1 : 0;
          return (
            <li key={e.id} className="relative flex gap-3 pb-4">
              {!lastItem && <span className="absolute left-[17px] top-9 bottom-0 w-px bg-line" aria-hidden />}
              <span className={cx("z-10 grid size-9 shrink-0 place-items-center rounded-full ring-1", tone)}>
                <Icon size={17} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold leading-snug">{e.title}</p>
                  <time className="shrink-0 font-mono text-[11px] text-muted">
                    {ddmmyyyy(e.at).slice(0, 5)} {hhmm(e.at)}
                  </time>
                </div>
                <p className="text-[12px] font-medium text-ink-2">
                  {actorLabel(e.actorId)}
                  {msIdx > 0 && <span className="text-muted"> · M{msIdx}</span>}
                </p>
                <p className="mt-1 text-[13px] text-ink">{e.description}</p>
                {file && (
                  <p className="mt-1 truncate font-mono text-[11px] text-cyan" title={file.hash}>
                    {file.name} · sha256 {shortHash(file.hash)}
                  </p>
                )}
                {e.messageId && (
                  <button
                    type="button"
                    onClick={() => jumpToMessage(dispatch, e.messageId!)}
                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-yellow hover:underline"
                  >
                    <CornerDownRight size={13} /> Xem tin nhắn liên quan
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
