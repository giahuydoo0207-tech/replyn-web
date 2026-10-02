"use client";

import { Check, ChevronRight, Circle } from "lucide-react";
import type { ReactNode } from "react";
import { FEE_LABEL, usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { initials, type PanelTab } from "@/lib/reducer";
import { useStore } from "@/lib/store";
import type { Milestone, Workspace } from "@/lib/types";
import { Avatar, Button, cx, StatusBadge } from "../ui";
import { useMilestoneActions } from "../useMilestoneActions";

const CLOSED = ["released_sim", "refunded", "split"];

export function OverviewTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const total = ws.milestones.reduce((a, m) => a + m.amount, 0);
  const done = ws.milestones.filter((m) => CLOSED.includes(m.status)).length;
  const inReview = ws.milestones.filter((m) => m.status === "in_review").length;
  const openDisputes = ws.disputes.filter((d) => d.status !== "resolved").length;
  const funded = ws.milestones.filter((m) => m.status !== "awaiting_funding").length;
  const current = ws.milestones.find((m) => !CLOSED.includes(m.status));
  const go = (tab: PanelTab) => dispatch({ type: "SET_PANEL", tab, open: true });

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-panel p-4">
        <h3 className="text-[17px] font-semibold leading-snug">{ws.title}</h3>
        <p className="mt-0.5 text-[22px] font-semibold tracking-tight">{usdc(total)}</p>
        <p className="text-[13px] text-ink-2">{FEE_LABEL[ws.feeTier]}</p>

        <p className="mt-3 text-[13px] text-ink-2">
          {ws.milestones.length} milestone · {inReview} đang chờ nghiệm thu · {openDisputes} tranh chấp
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/6" aria-label={`Hoàn tất ${done}/${ws.milestones.length}`}>
          <div className="h-full rounded-full bg-ink/80 transition-all" style={{ width: `${(done / ws.milestones.length) * 100}%` }} />
        </div>

        <ul className="mt-4 space-y-2">
          {[
            { id: ws.businessId, role: "Business" },
            { id: ws.freelancerId, role: "Freelancer" },
          ].map(({ id, role }) => {
            const u = state.users[id];
            return (
              <li key={id} className="flex items-center gap-2.5">
                <Avatar initials={initials(u.name)} bg="#233138" fg={u.color} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                <span className="text-xs text-muted">{role}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {current && <NextStep ws={ws} ms={current} idx={ws.milestones.indexOf(current) + 1} />}

      <section>
        <h4 className="mb-2 text-[13px] font-medium text-muted">Trạng thái bảo vệ</h4>
        <ul className="divide-y divide-white/5 rounded-xl bg-panel">
          <CheckItem
            ok={!!ws.termsLockedAt}
            title="Điều khoản đã khóa"
            detail={ws.termsLockedAt ? `${ddmmyyyy(ws.termsLockedAt)} ${hhmm(ws.termsLockedAt)}` : "Chưa khóa, hai bên cần xác nhận"}
            onClick={() => go("terms")}
          />
          <CheckItem
            ok={funded > 0}
            title="Ký quỹ mô phỏng"
            detail={`${funded}/${ws.milestones.length} milestone đã ký quỹ (mô phỏng)`}
            onClick={() => go("milestones")}
          />
          <CheckItem
            ok
            title="Review period"
            detail={`${ws.milestones[0]?.reviewDays ?? 3} ngày nghiệm thu sau mỗi lần nộp`}
          />
          <CheckItem ok title="Auto-release" detail="Hết review period mà không phản hồi → Đủ điều kiện giải ngân" />
          <CheckItem
            ok={ws.evidence.length > 0}
            title="Evidence log"
            detail={`${ws.evidence.length} sự kiện · ${ws.attachments.length} file có hash`}
            onClick={() => go("evidence")}
          />
        </ul>
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Phí vận hành được tính minh họa trong bản demo. Replyn chưa thu phí thật và không custody tiền thật.
      </p>
    </div>
  );
}

function NextStep({ ws, ms, idx }: { ws: Workspace; ms: Milestone; idx: number }) {
  const { actions, waiting } = useMilestoneActions(ws, ms);
  return (
    <section className="rounded-xl bg-panel p-4">
      <h4 className="text-[13px] font-medium text-muted">Việc cần làm tiếp</h4>
      <p className="mt-1 text-[15px] font-medium">
        Milestone {idx} · {ms.title}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <StatusBadge status={ms.status} />
        <span className="text-[13px] text-ink-2">{usdc(ms.amount)}</span>
      </div>
      {waiting && <p className="mt-2 text-[13px] text-ink-2">{waiting}</p>}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.key} variant={a.variant} onClick={a.run} className="!px-3 !py-1.5">
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function CheckItem({ ok, title, detail, onClick }: { ok: boolean; title: string; detail: string; onClick?: () => void }) {
  const body: ReactNode = (
    <>
      <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-success/15 text-success" : "text-muted")}>
        {ok ? <Check size={13} strokeWidth={3} /> : <Circle size={14} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[13px] text-ink-2">{detail}</span>
      </span>
      {onClick && <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03]">
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-3.5 py-2.5">{body}</div>
      )}
    </li>
  );
}
