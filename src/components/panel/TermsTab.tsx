"use client";

import { Lock, LockOpen } from "lucide-react";
import { FEE_LABEL, usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { Button } from "../ui";

export function TermsTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const locked = ws.termsLockedAt;
  const biz = state.users[ws.businessId];
  const fl = state.users[ws.freelancerId];

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-panel p-4">
        <div className="flex items-center gap-2">
          {locked ? <Lock size={16} className="text-ink-2" /> : <LockOpen size={16} className="text-amber" />}
          <h3 className="text-[15px] font-semibold">{locked ? "Điều khoản đã khóa" : "Điều khoản chưa khóa"}</h3>
        </div>
        {locked ? (
          <p className="mt-1 text-[13px] text-ink-2">
            Hai bên đã xác nhận. Không thể sửa đơn phương.
            <span className="block text-muted">
              {biz.short} & {fl.short} · {ddmmyyyy(locked)} {hhmm(locked)}
            </span>
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-ink-2">
              Rà lại phạm vi, tiêu chí và hạn của từng milestone. Sau khi khóa, mọi thay đổi cần cả hai bên đồng ý. Phải khóa
              điều khoản trước khi ký quỹ.
            </p>
            <Button variant="primary" className="mt-3 w-full" onClick={() => dispatch({ type: "LOCK_TERMS", wsId: ws.id })}>
              <Lock size={15} /> Hai bên xác nhận & khóa điều khoản
            </Button>
          </>
        )}
        <dl className="mt-3 space-y-1 border-t border-white/5 pt-3 text-[13px]">
          <Line k="Business" v={biz.name} />
          <Line k="Freelancer" v={fl.name} />
          <Line k="Gói phí" v={FEE_LABEL[ws.feeTier]} />
        </dl>
      </section>

      {ws.milestones.map((m, i) => (
        <section key={m.id} className="rounded-xl bg-panel p-4">
          <p className="text-xs text-muted">Milestone {i + 1}</p>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[15px] font-semibold leading-snug">{m.title}</h4>
            <span className="shrink-0 text-sm font-medium">{usdc(m.amount)}</span>
          </div>
          {m.scope && <p className="mt-1.5 text-[13px] text-ink-2">{m.scope}</p>}

          <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            <Stat k="Deadline" v={m.deadline} />
            <Stat k="Lượt sửa" v={`${m.revisionLimit} lần`} />
            <Stat k="Review" v={`${m.reviewDays} ngày`} />
          </dl>

          {m.deliverables && m.deliverables.length > 0 && <List title="Deliverables" items={m.deliverables} />}
          <List title="Tiêu chí nghiệm thu" items={m.criteria} />
        </section>
      ))}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-[13px] font-medium text-muted">{title}</p>
      <ul className="mt-1 space-y-0.5 text-[14px]">
        {items.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="text-muted">•</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
