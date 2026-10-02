"use client";

import { AlertTriangle, Check, Gavel, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { computePayout, FEE_LABEL, usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Dispute, FeeTier, Milestone, Workspace } from "@/lib/types";
import { FileCard } from "../FileCard";
import { Badge, Button, cx, StatusBadge } from "../ui";

export function DisputeTab({ ws }: { ws: Workspace }) {
  if (!ws.disputes.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-panel p-4 text-center">
          <ShieldCheck size={28} className="mx-auto text-muted" />
          <p className="mt-2 font-semibold">Chưa có tranh chấp</p>
          <p className="mt-1 text-sm text-ink-2">
            Khi có bất đồng, một bên mở tranh chấp trên milestone. Milestone sẽ được tạm giữ. Hai bên có thể cung cấp bằng
            chứng trước khi Đội ngũ Nova đưa ra quyết định.
          </p>
        </div>
        <FeeTable ws={ws} ms={ws.milestones[0]} gross={600} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {[...ws.disputes].reverse().map((d) => (
        <DisputeCard key={d.id} ws={ws} d={d} />
      ))}
    </div>
  );
}

const STEPS = ["Đã mở tranh chấp", "Đội ngũ Nova review", "Quyết định"] as const;

function DisputeCard({ ws, d }: { ws: Workspace; d: Dispute }) {
  const { state, dispatch } = useStore();
  const ms = ws.milestones.find((m) => m.id === d.milestoneId)!;
  const idx = ws.milestones.indexOf(ms) + 1;
  const step = d.status === "open" ? 0 : d.status === "reviewing" ? 1 : 2;
  const opener = state.users[d.openedBy];
  const [gross, setGross] = useState(Math.round(ms.amount * 0.6));
  const resolved = d.status === "resolved";

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-panel p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold">
            <AlertTriangle size={17} className="text-danger" /> Tranh chấp M{idx}
          </h3>
          <StatusBadge status={ms.status} />
        </div>
        <p className="mt-1 text-[13px] text-ink-2">
          {ms.title} · {usdc(ms.amount)}
        </p>

        <ol className="mt-3 flex items-center gap-1" aria-label="Tiến trình tranh chấp">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1">
              <span
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  i < step || resolved ? "bg-success/20 text-success" : i === step ? "bg-ink text-app" : "bg-elevated text-muted",
                )}
              >
                {i < step || resolved ? <Check size={13} /> : i + 1}
              </span>
              <span className={cx("text-[11px] leading-tight", i <= step ? "text-ink" : "text-muted")}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px min-w-2 flex-1 bg-line" />}
            </li>
          ))}
        </ol>

        <dl className="mt-4 space-y-2.5 text-[14px]">
          <div>
            <dt className="text-xs text-muted">Người mở</dt>
            <dd className="font-semibold">
              {opener.name} · {d.openedBy === ws.businessId ? "Business" : "Freelancer"}
              <span className="ml-2 text-xs font-normal text-muted">
                {ddmmyyyy(d.at)} {hhmm(d.at)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Lý do</dt>
            <dd className="mt-0.5 rounded-lg bg-white/[0.04] px-3 py-2">{d.reason}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Người review</dt>
            <dd className="font-semibold">Đội ngũ Nova</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] text-ink-2">
          Milestone sẽ được tạm giữ. Hai bên có thể cung cấp bằng chứng trước khi Đội ngũ Nova đưa ra quyết định.
        </p>
      </section>

      <section>
        <h4 className="text-[14px] font-semibold">File chứng cứ ({d.evidenceAttachmentIds.length})</h4>
        <ul className="mt-2 space-y-1.5">
          {d.evidenceAttachmentIds.length === 0 && <li className="text-sm text-muted">Chưa đính kèm file.</li>}
          {d.evidenceAttachmentIds.map((id) => {
            const a = ws.attachments.find((x) => x.id === id);
            return a ? (
              <li key={id} className="rounded-xl bg-panel px-3">
                <FileCard a={a} />
              </li>
            ) : null;
          })}
        </ul>
      </section>

      {resolved && ms.payout ? (
        <section className="rounded-xl bg-panel p-4">
          <h4 className="flex items-center gap-2 font-semibold">
            <Gavel size={17} /> Quyết định của Đội ngũ Nova
          </h4>
          <PayoutRows ws={ws} ms={ms} gross={ms.payout.freelancerGross} tier={ws.feeTier} />
        </section>
      ) : (
        <section className="rounded-xl bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">Mô phỏng quyết định</h4>
            <Badge tone="muted">Thao tác của Đội ngũ Nova</Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">Bản demo cho phép trình diễn quyết định Release / Refund / Split.</p>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-rail p-1" role="radiogroup" aria-label="Loại quyết định">
            {[
              { label: "Giải ngân", v: ms.amount },
              { label: "Hoàn tiền", v: 0 },
              { label: "Chia tiền", v: Math.round(ms.amount * 0.6) },
            ].map((o) => {
              const kind = gross === ms.amount ? "Giải ngân" : gross === 0 ? "Hoàn tiền" : "Chia tiền";
              return (
                <button
                  key={o.label}
                  role="radio"
                  aria-checked={kind === o.label}
                  type="button"
                  onClick={() => setGross(o.v)}
                  className={cx(
                    "rounded-lg py-2 text-sm font-semibold transition-colors",
                    kind === o.label ? "bg-white/12 text-ink" : "text-ink-2 hover:bg-white/6",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-[13px] text-ink-2" htmlFor={`split-${d.id}`}>
            Phần freelancer: <b className="text-ink">{usdc(gross)}</b> · Business: <b className="text-ink">{usdc(ms.amount - gross)}</b>
          </label>
          <input
            id={`split-${d.id}`}
            type="range"
            min={0}
            max={ms.amount}
            step={50}
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
            className="mt-2 w-full accent-[#E9E4CC]"
          />

          <PayoutRows ws={ws} ms={ms} gross={gross} tier={ws.feeTier} />

          <div className="mt-4 flex gap-2">
            {d.status === "open" ? (
              <Button variant="secondary" className="flex-1" onClick={() => dispatch({ type: "NOVA_REVIEW", wsId: ws.id, disputeId: d.id })}>
                Đội ngũ Nova bắt đầu review
              </Button>
            ) : (
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => dispatch({ type: "RESOLVE", wsId: ws.id, disputeId: d.id, freelancerGross: gross })}
              >
                <Gavel size={16} /> Ra quyết định
              </Button>
            )}
          </div>
        </section>
      )}

      <FeeTable ws={ws} ms={ms} gross={resolved && ms.payout ? ms.payout.freelancerGross : gross} />
    </div>
  );
}

function PayoutRows({ ws, ms, gross, tier }: { ws: Workspace; ms: Milestone; gross: number; tier: FeeTier }) {
  const p = computePayout(ms.amount, gross, tier);
  return (
    <dl className="mt-3 space-y-1.5 rounded-lg bg-white/[0.04] p-3 text-[14px]">
      <Line k="Milestone" v={usdc(ms.amount)} />
      <Line k={FEE_LABEL[ws.feeTier]} v={`− ${usdc(p.fee)}`} />
      <Line k="Freelancer nhận dự kiến" v={usdc(p.freelancerNet)} strong />
      <Line k="Business hoàn dự kiến" v={usdc(p.businessRefund)} strong />
      <Line k="Replyn fee dự kiến" v={usdc(p.fee)} />
    </dl>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{k}</dt>
      <dd className={cx("shrink-0 font-mono", strong && "font-bold")}>{v}</dd>
    </div>
  );
}

/** So sánh 2 mức phí mô phỏng — số liệu khớp ví dụ trong brief (1000 USDC, split 600/400) */
function FeeTable({ ws, ms, gross }: { ws: Workspace; ms: Milestone; gross: number }) {
  const { dispatch } = useStore();
  const tiers: FeeTier[] = ["BASIC", "ADVANCED"];
  const rows = tiers.map((t) => ({ t, full: computePayout(ms.amount, ms.amount, t), part: computePayout(ms.amount, gross, t) }));
  const isSplit = gross > 0 && gross < ms.amount;
  return (
    <section className="rounded-xl bg-panel p-4">
      <h4 className="font-semibold">Mô phỏng phí</h4>
      <p className="mt-0.5 text-[13px] text-ink-2">
        Phí chỉ tính trên phần freelancer nhận. Tất cả số liệu là mô phỏng trong MVP.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(({ t, full, part }) => {
          const active = ws.feeTier === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => dispatch({ type: "SET_FEE_TIER", wsId: ws.id, tier: t })}
              aria-pressed={active}
              disabled={ws.milestones.some((m) => m.payout)}
              title={ws.milestones.some((m) => m.payout) ? "Gói phí đã chốt vì có milestone đã chi trả (mô phỏng)" : undefined}
              className={cx(
                "rounded-xl p-3 text-left ring-1 transition-colors disabled:cursor-not-allowed",
                active ? "bg-white/8 ring-white/30" : "bg-white/[0.03] ring-transparent hover:ring-white/15",
              )}
            >
              <p className="text-sm font-semibold text-ink">
                {t} {t === "BASIC" ? "7%" : "10%"}
              </p>
              <p className="text-[11px] leading-tight text-muted">{FEE_LABEL[t]}</p>
              <dl className="mt-2 space-y-0.5 text-[12px]">
                <p className="text-[11px] font-semibold uppercase text-muted">Giải ngân toàn bộ</p>
                <Line k="Fee" v={usdc(full.fee)} />
                <Line k="Freelancer" v={usdc(full.freelancerNet)} strong />
                {isSplit && (
                  <>
                    <p className="pt-1.5 text-[11px] font-semibold uppercase text-muted">
                      Chia {part.freelancerGross}/{part.businessRefund}
                    </p>
                    <Line k="Fee" v={usdc(part.fee)} />
                    <Line k="Freelancer" v={usdc(part.freelancerNet)} strong />
                    <Line k="Business hoàn" v={usdc(part.businessRefund)} />
                  </>
                )}
              </dl>
            </button>
          );
        })}
      </div>
    </section>
  );
}
