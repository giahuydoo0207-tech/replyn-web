"use client";

import { ArrowRight, Check, FilePen, History, Lock, Plus, Trash2, Undo2, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import {
  canEditMilestone,
  canRemoveMilestone,
  currentVersion,
  fromInputDate,
  pendingChange,
  sameTerms,
  termsOf,
  toInputDate,
  totals,
  validTerms,
} from "@/lib/scopeChange";
import { useMe, useStore } from "@/lib/store";
import type { ChangeOp, MilestoneTerms, ScopeChange, ScopeChangeStatus, Workspace } from "@/lib/types";
import { Button, cx, Modal } from "../ui";

const STATUS: Record<ScopeChangeStatus, { label: string; cls: string }> = {
  pending: { label: "Đang chờ trả lời", cls: "bg-amber/15 text-amber" },
  accepted: { label: "Đã đồng ý", cls: "bg-success/12 text-success" },
  declined: { label: "Đã từ chối", cls: "bg-danger/15 text-danger" },
  withdrawn: { label: "Đã rút lại", cls: "bg-white/6 text-ink-2" },
};

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${usdc(Math.abs(n))}`;
const at = (ms: number) => `${hhmm(ms)}, ${ddmmyyyy(ms)}`;

/* ---------- Phần thay đổi: cũ gạch đi, mới tô đậm ---------- */

function Was({ children }: { children: ReactNode }) {
  return <span className="text-muted line-through decoration-muted/60">{children}</span>;
}

function Delta({ label, before, after }: { label: string; before: string; after: string }) {
  if (before === after) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
      <span className="w-[54px] shrink-0 text-muted">{label}</span>
      <Was>{before}</Was>
      <ArrowRight size={12} className="translate-y-[1px] text-muted" aria-label="thành" />
      <span className="font-medium text-ink">{after}</span>
    </p>
  );
}

/** Danh sách thay đổi của một đề xuất, dùng trong chat, tab Thỏa thuận và hộp thoại soạn đề xuất. */
export function ChangeDiff({ ws, ops, totalBefore }: { ws: Workspace; ops: ChangeOp[]; totalBefore?: number }) {
  const t = totals(ws.milestones, ops, totalBefore);
  return (
    <div>
      <ul className="divide-y divide-white/[0.06]">
        {ops.map((o, i) => (
          <li key={i} className="py-2.5 first:pt-0">
            {o.op === "edit" && (
              <>
                <p className="mb-1 text-[13px] font-medium">
                  {o.index && <span className="text-muted">Giai đoạn {o.index} · </span>}
                  {o.before.title}
                </p>
                <Delta label="Tên" before={o.before.title} after={o.after.title.trim()} />
                <Delta label="Số tiền" before={usdc(o.before.amount)} after={usdc(o.after.amount)} />
                <Delta label="Hạn" before={o.before.deadline} after={o.after.deadline} />
              </>
            )}
            {o.op === "add" && (
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="rounded bg-success/12 px-1.5 py-0.5 text-[11px] font-semibold text-success">Thêm</span>
                <span className="font-medium">{o.after.title}</span>
                <span className="text-ink-2">· {usdc(o.after.amount)} · hạn {o.after.deadline}</span>
              </p>
            )}
            {o.op === "remove" && (
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[11px] font-semibold text-danger">Bỏ</span>
                <Was>{o.before.title} · {usdc(o.before.amount)}</Was>
              </p>
            )}
          </li>
        ))}
      </ul>
      {t.delta !== 0 && (
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.08] pt-2.5 text-[13px]">
          <span className="text-muted">Tổng thỏa thuận</span>
          <span className="tabular-nums">
            <Was>{usdc(t.before)}</Was>
            <ArrowRight size={12} className="mx-1.5 inline translate-y-[-1px] text-muted" aria-label="thành" />
            <span className="font-semibold text-yellow">{usdc(t.after)}</span>
            <span className="ml-1.5 text-muted">({signed(t.delta)})</span>
          </span>
        </p>
      )}
    </div>
  );
}

/* ---------- Thẻ đề xuất ---------- */

/**
 * Thẻ đề xuất đổi phạm vi. Bên nhận thấy Đồng ý / Từ chối, người gửi thấy Rút lại. Đồng ý thay đổi thỏa thuận nên
 * phải xác nhận thêm một bước, ngay tại chỗ.
 */
export function ChangeCard({ ws, change, flash }: { ws: Workspace; change: ScopeChange; flash?: boolean }) {
  const { state, dispatch } = useStore();
  const meId = useMe();
  const [mode, setMode] = useState<"idle" | "confirm" | "decline">("idle");
  const [note, setNote] = useState("");
  const proposer = state.users[change.proposedBy];
  const other = state.users[change.proposedBy === ws.businessId ? ws.freelancerId : ws.businessId];
  const responder = change.respondedBy ? state.users[change.respondedBy] : undefined;
  const mine = change.proposedBy === meId;
  const party = meId === ws.businessId || meId === ws.freelancerId;
  const next = change.fromVersion + 1;
  const status = STATUS[change.status];

  return (
    <article
      id={`change-${change.id}`}
      aria-label={`Đề xuất thay đổi thỏa thuận của ${proposer?.name ?? "một bên"}`}
      className={cx(
        "rounded-xl bg-panel p-4 ring-1",
        change.status === "pending" ? "ring-amber/25" : "ring-white/[0.06]",
        flash && "flash",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-yellow/12 text-yellow">
            <FilePen size={17} />
          </span>
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold leading-snug">Đề xuất thay đổi thỏa thuận</h4>
            <p className="text-[12px] text-muted">
              {proposer?.name ?? "Một bên"} · {at(change.at)} · phiên bản {change.fromVersion} → {next}
            </p>
          </div>
        </div>
        <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold", status.cls)}>{status.label}</span>
      </header>

      <blockquote className="mt-3 border-l-2 border-yellow/50 pl-3 text-[14px] text-ink">{change.reason}</blockquote>

      <div className="mt-3 rounded-lg bg-white/[0.03] p-3">
        <ChangeDiff ws={ws} ops={change.ops} totalBefore={change.totalBefore} />
      </div>

      {change.status === "pending" && party && (
        <footer className="mt-3">
          {mine ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-ink-2">Đang chờ {other?.name ?? "bên kia"} trả lời.</p>
              <Button variant="ghost" onClick={() => dispatch({ type: "WITHDRAW_SCOPE_CHANGE", wsId: ws.id, changeId: change.id })}>
                <Undo2 size={15} /> Rút lại
              </Button>
            </div>
          ) : mode === "confirm" ? (
            <div role="alertdialog" aria-label="Xác nhận đồng ý" className="msg-in rounded-lg bg-yellow/[0.07] p-3 ring-1 ring-yellow/25">
              <p className="text-[13px] text-ink-2">
                Đồng ý sẽ cập nhật thỏa thuận lên <span className="font-medium text-ink">phiên bản {next}</span> cho cả hai bên. Không hoàn tác được; muốn đổi tiếp thì gửi đề xuất mới.
              </p>
              <div className="mt-2.5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMode("idle")}>Quay lại</Button>
                <Button variant="primary" autoFocus onClick={() => dispatch({ type: "RESPOND_SCOPE_CHANGE", wsId: ws.id, changeId: change.id, accept: true })}>
                  <Check size={15} /> Xác nhận đồng ý
                </Button>
              </div>
            </div>
          ) : mode === "decline" ? (
            <div className="msg-in rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.08]">
              <label className="text-[13px] text-ink-2" htmlFor={`decline-${change.id}`}>Lý do từ chối (không bắt buộc)</label>
              <textarea
                id={`decline-${change.id}`}
                rows={2}
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Giữ hạn cũ, mình chỉ đồng ý tăng giá"
                className="mt-1.5 w-full resize-none rounded-lg bg-rail px-3 py-2 text-[14px] ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yellow/60"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMode("idle")}>Quay lại</Button>
                <Button variant="danger" onClick={() => dispatch({ type: "RESPOND_SCOPE_CHANGE", wsId: ws.id, changeId: change.id, accept: false, note })}>
                  <X size={15} /> Từ chối đề xuất
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("decline")}>Từ chối</Button>
              <Button variant="primary" onClick={() => setMode("confirm")}>
                <Check size={15} /> Đồng ý
              </Button>
            </div>
          )}
        </footer>
      )}

      {change.status !== "pending" && change.respondedAt && (
        <p className="mt-3 text-[12px] text-muted">
          {change.status === "accepted" && `${responder?.name ?? "Bên kia"} đồng ý lúc ${at(change.respondedAt)} · thỏa thuận lên phiên bản ${next}.`}
          {change.status === "declined" &&
            `${responder?.name ?? "Bên kia"} từ chối lúc ${at(change.respondedAt)}${change.responseNote ? `: “${change.responseNote}”` : "."}`}
          {change.status === "withdrawn" && `${proposer?.name ?? "Người đề xuất"} rút lại lúc ${at(change.respondedAt)}.`}
        </p>
      )}
    </article>
  );
}

/* ---------- Phiên bản và lịch sử, trong tab Thỏa thuận ---------- */

export function VersionPanel({ ws }: { ws: Workspace }) {
  const { state } = useStore();
  const meId = useMe();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const pending = pendingChange(ws);
  const version = currentVersion(ws);
  const accepted = (ws.changes ?? []).filter((c) => c.status === "accepted");
  const closed = (ws.changes ?? []).filter((c) => c.status !== "pending").slice().reverse();
  const party = meId === ws.businessId || meId === ws.freelancerId;
  const locked = !!(ws.termsLockedAt || ws.agreement);
  const last = accepted[accepted.length - 1];
  const origin = ws.agreement?.acceptedAt ?? ws.termsLockedAt;
  // Chưa chốt thỏa thuận thì chưa có gì để đổi; khung này chỉ hiện sau khi hai bên đã khóa điều khoản.
  if (!locked) return null;

  return (
    <section className="rounded-xl bg-panel p-4" aria-label="Phiên bản thỏa thuận">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-muted">Đang áp dụng</p>
          <h3 className="flex items-baseline gap-2 text-[15px] font-semibold">
            Phiên bản {version}
            <span className="text-[12px] font-normal text-muted">
              {last?.respondedAt ? `cập nhật ${at(last.respondedAt)}` : origin ? `bản gốc · ${at(origin)}` : "bản gốc"}
            </span>
          </h3>
        </div>
        {party && (
          <Button onClick={() => setOpen(true)} disabled={!!pending} title={pending ? "Đang có một đề xuất chờ trả lời" : undefined}>
            <FilePen size={15} /> Đề xuất thay đổi
          </Button>
        )}
      </div>
      <p className="mt-1.5 max-w-[60ch] text-[13px] text-ink-2">
        {pending
          ? "Đang có một đề xuất chờ trả lời. Mỗi lúc chỉ có một đề xuất, để hai bên không bị rối."
          : "Muốn đổi giá, hạn hay thêm bớt giai đoạn? Gửi đề xuất, bên kia đồng ý thì thỏa thuận lên phiên bản mới."}
      </p>

      {pending && (
        <div className="mt-3">
          <ChangeCard ws={ws} change={pending} flash={state.ui.flashId === pending.id} />
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink"
          >
            <History size={14} /> Lịch sử thay đổi ({closed.length})
          </button>
          {showHistory && (
            <ol className="msg-in mt-3 space-y-3">
              {closed.map((c) => (
                <li key={c.id}>
                  <ChangeCard ws={ws} change={c} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {open && <ProposeChangeDialog ws={ws} onClose={() => setOpen(false)} />}
    </section>
  );
}

/* ---------- Soạn đề xuất ---------- */

type Row =
  | { kind: "existing"; id: string; before: MilestoneTerms; draft: MilestoneTerms; editable: boolean; removable: boolean; removed: boolean }
  | { kind: "new"; key: number; draft: MilestoneTerms };

const field =
  "h-9 w-full rounded-lg bg-rail px-2.5 text-[14px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yellow/60 disabled:opacity-50";

export function ProposeChangeDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const { dispatch } = useStore();
  const [rows, setRows] = useState<Row[]>(() =>
    ws.milestones.map((m) => ({
      kind: "existing",
      id: m.id,
      before: termsOf(m),
      draft: termsOf(m),
      editable: canEditMilestone(m),
      removable: canRemoveMilestone(m),
      removed: false,
    })),
  );
  const [reason, setReason] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [tried, setTried] = useState(false);

  const ops = useMemo<ChangeOp[]>(
    () =>
      rows.flatMap((r): ChangeOp[] => {
        if (r.kind === "new") return [{ op: "add", after: r.draft }];
        const index = ws.milestones.findIndex((m) => m.id === r.id) + 1;
        if (r.removed) return [{ op: "remove", milestoneId: r.id, index, before: r.before }];
        return sameTerms(r.before, r.draft) ? [] : [{ op: "edit", milestoneId: r.id, index, before: r.before, after: r.draft }];
      }),
    [rows, ws.milestones],
  );
  const invalid = rows.some((r) => (r.kind === "new" || (!r.removed && r.editable)) && !validTerms(r.draft));
  const canSend = ops.length > 0 && !invalid && reason.trim().length > 0;

  const patch = (i: number, p: Partial<MilestoneTerms>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, draft: { ...r.draft, ...p } } : r)));
  const toggleRemove = (i: number) =>
    setRows((rs) => rs.map((r, j) => (j === i && r.kind === "existing" ? { ...r, removed: !r.removed, draft: r.before } : r)));

  const send = () => {
    setTried(true);
    if (!canSend) return;
    dispatch({ type: "PROPOSE_SCOPE_CHANGE", wsId: ws.id, reason: reason.trim(), ops });
    onClose();
  };

  return (
    <Modal
      open
      size="lg"
      title="Đề xuất thay đổi thỏa thuận"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={send} aria-disabled={!canSend} className={cx(!canSend && "opacity-50")}>
            Gửi đề xuất
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-2">
        Sửa trực tiếp ở dưới. Bên kia sẽ thấy đúng phần thay đổi và chọn đồng ý hoặc từ chối. Giai đoạn đã giải ngân hoặc đang chờ
        xử lý thì giữ nguyên.
      </p>

      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => {
          const locked = r.kind === "existing" && !r.editable;
          const removed = r.kind === "existing" && r.removed;
          const changed = r.kind === "existing" && !r.removed && !sameTerms(r.before, r.draft);
          const bad = tried && (r.kind === "new" || (!removed && !locked)) && !validTerms(r.draft);
          return (
            <li
              key={r.kind === "existing" ? r.id : `new-${r.key}`}
              className={cx(
                "rounded-xl p-3 ring-1 transition-colors",
                removed ? "bg-danger/[0.05] ring-danger/25" : r.kind === "new" ? "bg-success/[0.05] ring-success/25" : changed ? "bg-yellow/[0.05] ring-yellow/30" : "bg-white/[0.03] ring-white/[0.06]",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-muted">
                  {r.kind === "new" ? "Giai đoạn mới" : `Giai đoạn ${i + 1}`}
                  {changed && <span className="ml-2 text-yellow">Đã sửa</span>}
                  {removed && <span className="ml-2 text-danger">Sẽ bỏ</span>}
                </span>
                {locked ? (
                  <span className="inline-flex items-center gap-1 text-muted"><Lock size={12} /> Không đổi được</span>
                ) : r.kind === "new" ? (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-2 hover:bg-white/6 hover:text-ink">
                    <X size={13} /> Xóa dòng
                  </button>
                ) : r.removable ? (
                  <button type="button" onClick={() => toggleRemove(i)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-2 hover:bg-white/6 hover:text-ink">
                    {removed ? <><Undo2 size={13} /> Giữ lại</> : <><Trash2 size={13} /> Bỏ giai đoạn</>}
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_128px_148px]">
                <input
                  aria-label="Tên giai đoạn"
                  className={cx(field, removed && "line-through")}
                  value={r.draft.title}
                  disabled={locked || removed}
                  placeholder="Tên giai đoạn"
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
                <label className="relative">
                  <span className="sr-only">Số tiền (USDC)</span>
                  <input
                    inputMode="decimal"
                    className={cx(field, "pr-12 tabular-nums")}
                    value={Number.isFinite(r.draft.amount) && r.draft.amount !== 0 ? String(r.draft.amount) : ""}
                    disabled={locked || removed}
                    placeholder="0"
                    onChange={(e) => patch(i, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) })}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">USDC</span>
                </label>
                <input
                  type="date"
                  aria-label="Hạn bàn giao"
                  className={cx(field, "[color-scheme:dark]")}
                  value={toInputDate(r.draft.deadline)}
                  disabled={locked || removed}
                  onChange={(e) => patch(i, { deadline: fromInputDate(e.target.value) })}
                />
              </div>
              {bad && <p className="mt-1.5 text-[12px] text-danger">Cần tên, số tiền lớn hơn 0 và hạn bàn giao.</p>}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, { kind: "new", key: nextKey, draft: { title: "", amount: 0, deadline: "" } }]);
          setNextKey((k) => k + 1);
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-link hover:bg-white/6 active:scale-[0.98]"
      >
        <Plus size={15} /> Thêm giai đoạn
      </button>

      <label className="mt-4 block text-[13px] font-medium" htmlFor="change-reason">
        Lý do thay đổi
      </label>
      <textarea
        id="change-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ví dụ: Khách thêm trang đặt bàn, cần thêm 1 tuần và 300 USDC"
        className="mt-1.5 w-full resize-none rounded-xl bg-rail px-3.5 py-2.5 text-[14px] ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yellow/60"
      />
      {tried && !reason.trim() && <p className="mt-1 text-[12px] text-danger">Hãy ghi lý do để bên kia dễ quyết định.</p>}

      <div className="mt-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
        <p className="mb-2 text-[12px] font-medium text-muted">Bên kia sẽ thấy</p>
        {ops.length ? <ChangeDiff ws={ws} ops={ops} /> : <p className="text-[13px] text-muted">Chưa có thay đổi nào.</p>}
      </div>
      {tried && ops.length === 0 && <p className="mt-1 text-[12px] text-danger">Sửa ít nhất một giai đoạn trước khi gửi.</p>}
    </Modal>
  );
}
