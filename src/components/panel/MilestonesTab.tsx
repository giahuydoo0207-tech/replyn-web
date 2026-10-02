"use client";

import { CalendarClock, Hourglass, RefreshCw } from "lucide-react";
import { computePayout, FEE_LABEL, usdc } from "@/lib/fees";
import { hhmm, ddmmyyyy } from "@/lib/format";
import { jumpToMessage, useStore } from "@/lib/store";
import type { Milestone, Workspace } from "@/lib/types";
import { FileCard } from "../chat/Messages";
import { Button, StatusBadge } from "../ui";
import { useMilestoneActions } from "../useMilestoneActions";

export function MilestonesTab({ ws }: { ws: Workspace }) {
  const done = ws.milestones.filter((m) => ["released_sim", "refunded", "split"].includes(m.status)).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-2">
          Hoàn tất {done}/{ws.milestones.length} milestone
        </span>
        <span className="text-xs text-muted">Điều khoản khóa {ddmmyyyy(ws.termsLockedAt)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-yellow transition-all" style={{ width: `${(done / ws.milestones.length) * 100}%` }} />
      </div>
      {ws.milestones.map((m, i) => (
        <MilestonePanelCard key={m.id} ws={ws} ms={m} idx={i + 1} />
      ))}
    </div>
  );
}

function MilestonePanelCard({ ws, ms, idx }: { ws: Workspace; ms: Milestone; idx: number }) {
  const { state, dispatch } = useStore();
  const { actions, waiting } = useMilestoneActions(ws, ms);
  const est = ms.payout ?? computePayout(ms.amount, ms.amount, ws.feeTier);
  const subs = ws.submissions.filter((s) => s.milestoneId === ms.id);
  return (
    <article className="rounded-2xl bg-panel ring-1 ring-line">
      <div className="px-4 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Milestone {idx}</p>
            <h3 className="text-[16px] font-semibold leading-snug">{ms.title}</h3>
          </div>
          <p className="shrink-0 text-[17px] font-bold text-yellow">{usdc(ms.amount)}</p>
        </div>
        <StatusBadge status={ms.status} className="mt-2" />

        <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <Stat icon={<CalendarClock size={14} />} k="Deadline" v={ms.deadline} />
          <Stat icon={<Hourglass size={14} />} k="Nghiệm thu" v={`${ms.reviewDays} ngày`} />
          <Stat icon={<RefreshCw size={14} />} k="Lượt sửa" v={`${ms.revisionsUsed}/${ms.revisionLimit}`} />
        </dl>

        <p className="mt-3 text-[13px] font-semibold text-ink-2">Tiêu chí nghiệm thu</p>
        <ul className="mt-1 space-y-1 text-[14px]">
          {ms.criteria.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-yellow">✓</span>
              {c}
            </li>
          ))}
        </ul>

        {subs.length > 0 && (
          <>
            <p className="mt-3 text-[13px] font-semibold text-ink-2">Bản nộp</p>
            <ul className="mt-1 space-y-1">
              {subs.map((s) => {
                const a = ws.attachments.find((x) => x.id === s.attachmentId)!;
                return (
                  <li key={s.id} className="rounded-xl bg-rail px-2.5 pb-1.5">
                    <FileCard a={a} compact />
                    <p className="flex items-center justify-between text-[11px] text-muted">
                      <span>
                        v{s.version} · {ddmmyyyy(s.at)} {hhmm(s.at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToMessage(dispatch, s.messageId)}
                        className="font-semibold text-yellow hover:underline"
                      >
                        Xem trong chat
                      </button>
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <dl className="mt-3 space-y-1 rounded-xl bg-rail p-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">{FEE_LABEL[ws.feeTier]}</dt>
            <dd className="font-mono">{usdc(est.fee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Freelancer nhận dự kiến</dt>
            <dd className="font-mono font-bold">{usdc(est.freelancerNet)}</dd>
          </div>
          {est.businessRefund > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-2">Business hoàn dự kiến</dt>
              <dd className="font-mono font-bold">{usdc(est.businessRefund)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {actions.map((a) => (
          <Button key={a.key} variant={a.variant} onClick={a.run} className="!px-3 !py-1.5">
            {a.label}
          </Button>
        ))}
        {waiting && <span className="text-[13px] text-muted">{waiting}</span>}
        {!actions.length && !waiting && (
          <span className="text-[13px] text-muted">
            Milestone đã khép lại · {state.users[ws.freelancerId].short} nhận dự kiến {usdc(est.freelancerNet)}
          </span>
        )}
      </div>
    </article>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-lg bg-rail px-2 py-1.5">
      <dt className="flex items-center gap-1 text-[11px] text-muted">
        {icon}
        {k}
      </dt>
      <dd className="mt-0.5 font-semibold">{v}</dd>
    </div>
  );
}
