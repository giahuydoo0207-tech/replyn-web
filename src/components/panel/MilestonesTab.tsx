"use client";

import { computePayout, FEE_LABEL, usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { jumpToMessage, useStore } from "@/lib/store";
import type { Milestone, Workspace } from "@/lib/types";
import { FileCard } from "../FileCard";
import { Button, StatusBadge } from "../ui";
import { useMilestoneActions } from "../useMilestoneActions";

export function MilestonesTab({ ws }: { ws: Workspace }) {
  return (
    <div className="space-y-3">
      {ws.milestones.map((m, i) => (
        <MilestonePanelCard key={m.id} ws={ws} ms={m} idx={i + 1} />
      ))}
      <p className="px-1 pt-1 text-xs leading-relaxed text-muted">
        Phí vận hành được tính minh họa trong bản demo. Replyn chưa thu phí và không giữ tiền thật.
      </p>
    </div>
  );
}

function MilestonePanelCard({ ws, ms, idx }: { ws: Workspace; ms: Milestone; idx: number }) {
  const { dispatch } = useStore();
  const { actions, waiting } = useMilestoneActions(ws, ms);
  const est = ms.payout ?? computePayout(ms.amount, ms.amount, ws.feeTier);
  const subs = ws.submissions.filter((s) => s.milestoneId === ms.id);

  return (
    <article className="rounded-xl bg-panel">
      <div className="px-4 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Giai đoạn {idx}</p>
            <h3 className="text-[15px] font-semibold leading-snug">{ms.title}</h3>
          </div>
          <p className="shrink-0 text-[15px] font-semibold">{usdc(ms.amount)}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <StatusBadge status={ms.status} />
          <span>Hạn {ms.deadline}</span>
          <span>
            Sửa {ms.revisionsUsed}/{ms.revisionLimit}
          </span>
        </div>

        {subs.length > 0 && (
          <ul className="mt-3 divide-y divide-white/5 rounded-lg bg-white/[0.03] px-3">
            {subs.map((s) => {
              const a = ws.attachments.find((x) => x.id === s.attachmentId)!;
              return (
                <li key={s.id} className="py-1">
                  <FileCard a={a} />
                  <p className="flex items-center justify-between pb-1 text-[11px] text-muted">
                    <span>
                      Nộp {ddmmyyyy(s.at)} {hhmm(s.at)}
                    </span>
                    <button type="button" onClick={() => jumpToMessage(dispatch, s.messageId)} className="text-ink-2 underline-offset-2 hover:underline">
                      Xem trong chat
                    </button>
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{FEE_LABEL[ws.feeTier]}</dt>
            <dd>{usdc(est.fee)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Người thực hiện dự kiến nhận</dt>
            <dd className="font-medium">{usdc(est.freelancerNet)}</dd>
          </div>
          {est.businessRefund > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Doanh nghiệp dự kiến nhận lại</dt>
              <dd className="font-medium">{usdc(est.businessRefund)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 px-4 py-3">
        {actions.map((a) => (
          <Button key={a.key} variant={a.variant} onClick={a.run} className="!px-3 !py-1.5">
            {a.label}
          </Button>
        ))}
        {waiting && <span className="text-[13px] text-muted">{waiting}</span>}
        {!actions.length && !waiting && <span className="text-[13px] text-muted">Giai đoạn đã hoàn tất</span>}
      </div>
    </article>
  );
}
