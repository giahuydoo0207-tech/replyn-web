"use client";

import { FileCheck, Lock, LockOpen } from "lucide-react";
import { FEE_LABEL, usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { Button } from "../ui";
import { SealCard } from "./SealCard";

export function TermsTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const locked = ws.termsLockedAt;
  const biz = state.users[ws.businessId];
  const fl = state.users[ws.freelancerId];

  const agreement = ws.agreement;

  return (
    <div className="space-y-4">
      {agreement && (
        <section className="rounded-xl bg-panel p-4" aria-label="Thỏa thuận từ Nova">
          <div className="flex items-center gap-2">
            <FileCheck size={16} className="text-ink-2" />
            <h3 className="text-[15px] font-semibold">Thỏa thuận từ Nova</h3>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            {biz.name} gửi đề xuất trên Nova, {fl.name} chấp nhận ngày {ddmmyyyy(agreement.acceptedAt)}. Replyn thực hiện đúng thỏa thuận này.
          </p>
          <p className="mt-3 whitespace-pre-wrap text-[14px]">{agreement.scope}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            <Stat k="Tổng ngân sách" v={usdc(agreement.totalAmount)} />
            <Stat k="Bắt đầu" v={isoDate(agreement.startDate)} />
            <Stat k="Deadline" v={isoDate(agreement.deadline)} />
          </dl>
          {agreement.deliverables.length > 0 && <List title="Sản phẩm bàn giao" items={agreement.deliverables} />}
          {agreement.notes && <List title="Ghi chú" items={[agreement.notes]} />}
          <p className="mt-3 text-[12px] text-muted">Cấp vốn, giải ngân và phí hiện đang được mô phỏng. Nova và Replyn chưa giữ tiền thật.</p>
        </section>
      )}
      {agreement && <SealCard workspaceId={agreement.novaWorkspaceId} />}
      <section className="rounded-xl bg-panel p-4">
        <div className="flex items-center gap-2">
          {locked ? <Lock size={16} className="text-ink-2" /> : <LockOpen size={16} className="text-amber" />}
          <h3 className="text-[15px] font-semibold">
            {agreement ? "Thỏa thuận đã khóa" : locked ? "Thỏa thuận đã xác nhận" : "Thỏa thuận chưa xác nhận"}
          </h3>
        </div>
        {agreement ? (
          // Đề xuất đã được chấp nhận trên Nova: thỏa thuận khóa từ lúc đó cho cả hai bên, không cần xác nhận lại.
          <p className="mt-1 text-[13px] text-ink-2">
            Đã khóa khi {fl.name} chấp nhận đề xuất trên Nova · {ddmmyyyy(agreement.acceptedAt)} {hhmm(agreement.acceptedAt)}
            <span className="block text-muted">Không thể sửa đơn phương.</span>
          </p>
        ) : locked ? (
          <p className="mt-1 text-[13px] text-ink-2">
            Hai bên đã xác nhận. Không thể sửa đơn phương.
            <span className="block text-muted">
              {biz.short} & {fl.short} · {ddmmyyyy(locked)} {hhmm(locked)}
            </span>
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-ink-2">
              Rà lại phạm vi, tiêu chí và hạn của từng giai đoạn. Sau khi xác nhận, mọi thay đổi cần cả hai bên đồng ý.
              Thỏa thuận phải được xác nhận trước khi kích hoạt ký quỹ mô phỏng.
            </p>
            <Button variant="primary" className="mt-3 w-full" onClick={() => dispatch({ type: "LOCK_TERMS", wsId: ws.id })}>
              <Lock size={15} /> Hai bên xác nhận thỏa thuận
            </Button>
          </>
        )}
        <dl className="mt-3 space-y-1 border-t border-white/5 pt-3 text-[13px]">
          <Line k="Doanh nghiệp" v={biz.name} />
          <Line k="Người thực hiện" v={fl.name} />
          <Line k="Gói phí" v={FEE_LABEL[ws.feeTier]} />
        </dl>
      </section>

      {ws.milestones.map((m, i) => (
        <section key={m.id} className="rounded-xl bg-panel p-4">
          <p className="text-xs text-muted">Giai đoạn {i + 1}</p>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[15px] font-semibold leading-snug">{m.title}</h4>
            <span className="shrink-0 text-sm font-medium">{usdc(m.amount)}</span>
          </div>
          {m.scope && <p className="mt-1.5 text-[13px] text-ink-2">{m.scope}</p>}

          <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            <Stat k="Hạn bàn giao" v={m.deadline} />
            <Stat k="Lượt sửa" v={`${m.revisionLimit} lần`} />
            <Stat k="Thời gian duyệt" v={`${m.reviewDays} ngày`} />
          </dl>

          {m.deliverables && m.deliverables.length > 0 && <List title="Sản phẩm bàn giao" items={m.deliverables} />}
          {m.criteria.length > 0 && <List title="Tiêu chí nghiệm thu" items={m.criteria} />}
        </section>
      ))}
    </div>
  );
}

/** "2026-11-10" -> "10/11/2026" */
function isoDate(value: string | null) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
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
