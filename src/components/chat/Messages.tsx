"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  Clock,
  Copy,
  FileArchive,
  FileText,
  Flag,
  Gavel,
  Image as ImageIcon,
  Lock,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { computePayout, FEE_LABEL, FEE_RATE, usdc } from "@/lib/fees";
import { dayKey, dayLabel, fileSize, hhmm, shortHash } from "@/lib/format";
import { previewOf } from "@/lib/preview";
import { findAttachment, initials, NOVA_TEAM_ID, SYSTEM_ID } from "@/lib/reducer";
import { jumpToMessage, useMe, useStore } from "@/lib/store";
import type { Attachment, Conversation, Message } from "@/lib/types";
import { useMilestoneActions } from "../useMilestoneActions";
import { Avatar, Badge, Button, cx, ReplynMark, StatusBadge } from "../ui";

const GROUP_GAP = 5 * 60 * 1000;
const isService = (m: Message) => m.senderId === SYSTEM_ID || m.senderId === NOVA_TEAM_ID || m.kind === "system";

export function MessageList({ conv, messages }: { conv: Conversation; messages: Message[] }) {
  const { state } = useStore();
  const showAvatars = conv.kind !== "nova";
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-[3px] px-3 pb-4 pt-3 sm:px-6">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
        const sameAsPrev = !newDay && prev && prev.senderId === m.senderId && !isService(prev) && m.at - prev.at < GROUP_GAP;
        const sameAsNext =
          next && dayKey(next.at) === dayKey(m.at) && next.senderId === m.senderId && !isService(next) && next.at - m.at < GROUP_GAP;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="my-2 flex justify-center">
                <span className="rounded-lg bg-[#1b1f15]/95 px-3 py-1 text-xs font-semibold text-ink-2 shadow ring-1 ring-white/5 backdrop-blur">
                  {dayLabel(m.at, state.clock)}
                </span>
              </div>
            )}
            <MessageRow
              m={m}
              conv={conv}
              first={!sameAsPrev}
              last={!sameAsNext}
              showAvatars={showAvatars}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function MessageRow({
  m,
  conv,
  first,
  last,
  showAvatars,
}: {
  m: Message;
  conv: Conversation;
  first: boolean;
  last: boolean;
  showAvatars: boolean;
}) {
  const { state } = useStore();
  const meId = useMe();
  const flash = state.ui.flashId === m.id;

  if (m.kind === "system") return <ServiceMessage m={m} flash={flash} />;
  if (["milestone", "payment", "decision"].includes(m.kind)) {
    return (
      <div id={`msg-${m.id}`} className="msg-in my-1.5 flex justify-center">
        <div className={cx("w-full max-w-[480px] rounded-2xl", flash && "flash")}>
          {m.kind === "milestone" && <MilestoneCard m={m} />}
          {m.kind === "payment" && <PaymentCard m={m} />}
          {m.kind === "decision" && <DecisionCard m={m} />}
        </div>
      </div>
    );
  }

  const out = m.senderId === meId;
  const sender = state.users[m.senderId];
  const showName = !out && showAvatars && first;

  return (
    <div
      id={`msg-${m.id}`}
      className={cx("msg-in flex items-end gap-2", out ? "justify-end" : "justify-start", first && "mt-1.5")}
    >
      {!out && showAvatars && (
        <div className="w-[34px] shrink-0">
          {last && sender && <Avatar initials={initials(sender.name)} bg="#1e2318" fg={sender.color} size={34} />}
        </div>
      )}
      <div
        className={cx(
          "relative max-w-[min(560px,85%)] rounded-2xl text-[15px] leading-[1.4] shadow-[0_1px_1px_rgb(0_0_0/0.4)]",
          m.kind === "proposal"
            ? "w-[min(440px,85vw)] bg-system ring-1 ring-inset ring-yellow/40"
            : m.kind === "dispute"
              ? "bg-[#2b1414] px-3 pb-1.5 pt-1.5 ring-1 ring-inset ring-danger/50"
              : out
                ? "bg-bubble-out px-3 pb-1.5 pt-1.5 ring-1 ring-inset ring-yellow/30"
                : "bg-bubble-in px-3 pb-1.5 pt-1.5",
          last && (out ? "rounded-br-md" : "rounded-bl-md"),
          flash && "flash",
        )}
      >
        {showName && sender && m.kind !== "proposal" && (
          <p className="mb-0.5 text-[14px] font-semibold" style={{ color: sender.color }}>
            {sender.name}
            {conv.kind === "replyn" && (
              <span className="ml-1.5 text-xs font-medium text-muted">
                {m.senderId === state.workspaces[conv.workspaceId!]?.businessId ? "Business" : "Freelancer"}
              </span>
            )}
          </p>
        )}
        {m.replyToId && <ReplyQuote id={m.replyToId} chatId={m.chatId} />}
        <Body m={m} out={out} />
        {m.kind !== "proposal" && <Meta at={m.at} out={out} />}
      </div>
    </div>
  );
}

function Meta({ at, out, className }: { at: number; out: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "float-right ml-3 mt-1.5 inline-flex translate-y-1 items-center gap-1 text-[11px] leading-none",
        out ? "text-[#e7cf8a]" : "text-muted",
        className,
      )}
    >
      {hhmm(at)}
      {out && <CheckCheck size={15} className="text-cyan" aria-label="Đã xem" />}
    </span>
  );
}

function ReplyQuote({ id, chatId }: { id: string; chatId: string }) {
  const { state, dispatch } = useStore();
  const target = state.messages[chatId]?.find((x) => x.id === id);
  if (!target) return null;
  const u = state.users[target.senderId];
  return (
    <button
      type="button"
      onClick={() => jumpToMessage(dispatch, id)}
      className="mb-1 block w-full rounded-md border-l-[3px] bg-black/20 py-1 pl-2 pr-2 text-left hover:bg-black/30"
      style={{ borderColor: u?.color ?? "#FFD33D" }}
    >
      <span className="block text-[13px] font-semibold" style={{ color: u?.color }}>
        {u?.name}
      </span>
      <span className="line-clamp-1 text-[13px] text-ink-2">{previewOf(state, target)}</span>
    </button>
  );
}

function Body({ m, out }: { m: Message; out: boolean }) {
  const { state } = useStore();
  switch (m.kind) {
    case "text":
      return <span className="whitespace-pre-wrap break-words">{m.text}</span>;
    case "file": {
      const a = findAttachment(state, m.refs?.attachmentId);
      return (
        <>
          {a && <FileCard a={a} out={out} />}
          {m.text && <p className="mt-1">{m.text}</p>}
        </>
      );
    }
    case "submission":
      return <SubmissionBody m={m} out={out} />;
    case "dispute":
      return <DisputeBody m={m} />;
    case "proposal":
      return <ProposalCard m={m} />;
    default:
      return null;
  }
}

/* ---------- Service message kiểu Telegram ---------- */

function ServiceMessage({ m, flash }: { m: Message; flash: boolean }) {
  const nova = m.senderId === NOVA_TEAM_ID;
  const locked = m.text?.startsWith("Điều khoản đã khóa");
  return (
    <div id={`msg-${m.id}`} className="msg-in my-1.5 flex justify-center px-6">
      <span
        className={cx(
          "inline-flex max-w-[560px] items-start gap-1.5 rounded-xl px-3 py-1.5 text-center text-[13px] font-medium leading-snug shadow ring-1",
          nova ? "bg-[#14242a] text-cyan ring-cyan/25" : "bg-[#221c07]/95 text-[#f3dc8b] ring-yellow/15",
          flash && "flash",
        )}
      >
        {nova ? <ShieldCheck size={15} className="mt-px shrink-0" /> : locked ? <Lock size={14} className="mt-0.5 shrink-0" /> : null}
        <span>
          {nova && <b>Đội ngũ Nova · </b>}
          {m.text}
          <span className="ml-2 text-[11px] opacity-60">{hhmm(m.at)}</span>
        </span>
      </span>
    </div>
  );
}

/* ---------- File card ---------- */

function fileIcon(name: string): ReactNode {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "fig") return <PenTool size={20} />;
  if (ext === "apk" || ext === "ipa") return <Smartphone size={20} />;
  if (["zip", "rar", "7z"].includes(ext ?? "")) return <FileArchive size={20} />;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext ?? "")) return <ImageIcon size={20} />;
  return <FileText size={20} />;
}

export function FileCard({ a, out, compact }: { a: Attachment; out?: boolean; compact?: boolean }) {
  return (
    <div className={cx("flex items-center gap-3 rounded-xl py-1.5", compact ? "px-0" : "my-0.5 bg-black/20 px-2.5 py-2")}>
      <div
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          out ? "bg-yellow text-[#3b2c00]" : "bg-yellow/15 text-yellow",
        )}
      >
        {fileIcon(a.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{a.name}</span>
          {a.version && (
            <Badge tone="yellow" className="!px-1.5 !py-0 text-[11px]">
              v{a.version}
            </Badge>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
          {fileSize(a.size)}
          <span className="opacity-50">·</span>
          <button
            type="button"
            title={`SHA-256: ${a.hash} (bấm để sao chép)`}
            onClick={() => navigator.clipboard?.writeText(a.hash)}
            className="inline-flex items-center gap-1 font-mono text-cyan hover:underline"
          >
            sha256 {shortHash(a.hash)}
            <Copy size={11} />
          </button>
        </p>
      </div>
    </div>
  );
}

/* ---------- Submission ---------- */

function SubmissionBody({ m, out }: { m: Message; out: boolean }) {
  const { state } = useStore();
  const ws = state.workspaces[m.refs!.workspaceId!];
  const ms = ws.milestones.find((x) => x.id === m.refs?.milestoneId)!;
  const idx = ws.milestones.indexOf(ms) + 1;
  const a = findAttachment(state, m.refs?.attachmentId);
  const latest = ms.submissionIds.at(-1) === m.refs?.submissionId;
  return (
    <div className="min-w-[260px]">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-yellow">
        <Flag size={13} /> Nộp sản phẩm · Milestone {idx}
      </p>
      {a && <FileCard a={a} out={out} />}
      {m.text && <p className="mt-1 whitespace-pre-wrap">{m.text}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="cyan">Đã nộp sản phẩm</Badge>
        {latest ? (
          <StatusBadge status={ms.status} />
        ) : (
          <Badge tone="muted">Đã có bản mới hơn</Badge>
        )}
      </div>
      {latest && <InlineActions wsId={ws.id} milestoneId={ms.id} only={["accept", "revise"]} />}
    </div>
  );
}

function InlineActions({ wsId, milestoneId, only }: { wsId: string; milestoneId: string; only?: string[] }) {
  const { state } = useStore();
  const ws = state.workspaces[wsId];
  const ms = ws.milestones.find((x) => x.id === milestoneId)!;
  const { actions } = useMilestoneActions(ws, ms);
  const list = only ? actions.filter((a) => only.includes(a.key)) : actions;
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((a) => (
        <Button key={a.key} variant={a.variant} onClick={a.run} className="!px-3 !py-1.5">
          {a.label}
        </Button>
      ))}
    </div>
  );
}

/* ---------- Dispute ---------- */

function DisputeBody({ m }: { m: Message }) {
  const { state, dispatch } = useStore();
  const ws = state.workspaces[m.refs!.workspaceId!];
  const d = ws.disputes.find((x) => x.id === m.refs?.disputeId);
  const ms = ws.milestones.find((x) => x.id === m.refs?.milestoneId)!;
  return (
    <div className="min-w-[260px]">
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-danger">
        <AlertTriangle size={16} /> Đã mở tranh chấp
      </p>
      <p className="mt-0.5 text-xs text-ink-2">
        Milestone {ws.milestones.indexOf(ms) + 1} · {ms.title} · {usdc(ms.amount)}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap">{m.text}</p>
      <p className="mt-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-[13px] text-[#ffc9c9]">
        Milestone sẽ được tạm giữ. Hai bên có thể cung cấp bằng chứng trước khi Đội ngũ Nova đưa ra quyết định.
      </p>
      <div className="mt-2 flex items-center gap-2">
        {d && <Badge tone="muted">{d.evidenceAttachmentIds.length} file bằng chứng</Badge>}
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_PANEL", tab: "dispute", open: true })}
          className="inline-flex items-center gap-1 text-sm font-semibold text-danger hover:underline"
        >
          Xem tranh chấp <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------- Proposal ---------- */

function ProposalCard({ m }: { m: Message }) {
  const { state, dispatch } = useStore();
  const conv = state.conversations[m.chatId];
  const p = conv.proposal!;
  const total = p.milestones.reduce((a, x) => a + x.amount, 0);
  const status = conv.proposalStatus ?? "pending";
  const statusUi = {
    pending: <Badge tone="amber"><Clock size={12} /> Đang chờ phản hồi</Badge>,
    opened: <Badge tone="success"><CheckCheck size={12} /> Đã mở</Badge>,
    later: <Badge tone="muted">Để sau</Badge>,
  }[status];
  return (
    <div className="overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-yellow/20 bg-yellow/10 px-4 py-3">
        <ReplynMark size={34} />
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-yellow">Đề xuất chuyển sang Replyn</p>
          <p className="text-xs text-ink-2">từ {state.users[m.senderId].name} · {hhmm(m.at)}</p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[14px] text-ink">
          Chuyển cuộc trao đổi này sang workspace Replyn để khóa điều khoản, tạo milestone, nộp sản phẩm, nghiệm thu và theo
          dõi bằng chứng dự án.
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-black/25 p-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted">Dự án</dt>
            <dd className="font-semibold">{p.projectTitle}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Tổng giá trị</dt>
            <dd className="font-semibold text-yellow">{usdc(total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Milestone</dt>
            <dd className="font-semibold">{p.milestones.length} giai đoạn</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Gói phí</dt>
            <dd className="font-semibold">
              {p.feeTier} · {FEE_LABEL[p.feeTier]}
            </dd>
          </div>
        </dl>
        <p className="border-l-2 border-yellow pl-2.5 text-[13px] italic text-[#f3dc8b]">
          Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="yellow">Demo: escrow mô phỏng</Badge>
          {statusUi}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={() => dispatch({ type: "OPEN_REPLYN", chatId: conv.id })}>
            {status === "opened" ? "Vào workspace" : "Mở Replyn"} <ArrowRight size={16} />
          </Button>
          {status === "pending" && (
            <Button variant="secondary" onClick={() => dispatch({ type: "PROPOSAL_LATER", chatId: conv.id })}>
              Để sau
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Milestone card (system) ---------- */

function MilestoneCard({ m }: { m: Message }) {
  const { state, dispatch } = useStore();
  const ws = state.workspaces[m.refs!.workspaceId!];
  const ms = ws.milestones.find((x) => x.id === m.refs?.milestoneId)!;
  const idx = ws.milestones.indexOf(ms) + 1;
  const { actions, waiting } = useMilestoneActions(ws, ms);
  return (
    <div className="rounded-2xl bg-panel/95 ring-1 ring-line backdrop-blur">
      <div className="flex items-start gap-3 px-4 pt-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-yellow/15 font-bold text-yellow">{idx}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Milestone {idx}</p>
          <p className="text-[16px] font-semibold leading-snug">{ms.title}</p>
        </div>
        <p className="shrink-0 text-[16px] font-bold text-yellow">{usdc(ms.amount)}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-[13px] text-ink-2">
        <span>Deadline {ms.deadline}</span>
        <span>Nghiệm thu {ms.reviewDays} ngày</span>
        <span>
          Sửa {ms.revisionsUsed}/{ms.revisionLimit}
        </span>
      </div>
      <ul className="mx-4 mt-2 space-y-0.5 text-[13px] text-ink">
        {ms.criteria.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="text-yellow">✓</span>
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <StatusBadge status={ms.status} />
        {waiting && !actions.length && <span className="text-xs text-muted">{waiting}</span>}
        <div className="ml-auto flex gap-2">
          {actions.slice(0, 1).map((a) => (
            <Button key={a.key} variant={a.variant} onClick={a.run} className="!px-3 !py-1.5">
              {a.label}
            </Button>
          ))}
          <Button variant="ghost" className="!px-2.5 !py-1.5" onClick={() => dispatch({ type: "SET_PANEL", tab: "milestones", open: true })}>
            Chi tiết
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Payment (mô phỏng) ---------- */

function PaymentCard({ m }: { m: Message }) {
  const { state } = useStore();
  const ws = state.workspaces[m.refs!.workspaceId!];
  const ms = ws.milestones.find((x) => x.id === m.refs?.milestoneId)!;
  const idx = ws.milestones.indexOf(ms) + 1;
  const released = m.text === "released";
  const payout = ms.payout ?? computePayout(ms.amount, ms.amount, ws.feeTier);
  return (
    <div className="rounded-2xl bg-[#14200f]/95 px-4 py-3 ring-1 ring-success/30">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
          {released ? <CheckCheck size={20} /> : <Lock size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{released ? "Đã giải ngân (mô phỏng)" : "Đã cấp vốn (mô phỏng)"}</p>
          <p className="text-xs text-ink-2">
            Milestone {idx} · {ms.title}
          </p>
        </div>
        <p className="text-[16px] font-bold text-success">{usdc(ms.amount)}</p>
      </div>
      {released ? (
        <dl className="mt-2.5 space-y-1 border-t border-white/5 pt-2 text-[13px]">
          <Row k={`${FEE_LABEL[ws.feeTier]}`} v={`− ${usdc(payout.fee)}`} />
          <Row k="Freelancer nhận dự kiến" v={usdc(payout.freelancerNet)} strong />
        </dl>
      ) : (
        <p className="mt-2 text-[13px] text-ink-2">
          Business đã kích hoạt ký quỹ mô phỏng. Replyn không custody tiền thật.
        </p>
      )}
      <p className="mt-1.5 text-right text-[11px] text-muted">{hhmm(m.at)}</p>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{k}</dt>
      <dd className={cx("font-mono", strong ? "font-bold text-ink" : "text-ink")}>{v}</dd>
    </div>
  );
}

/* ---------- Quyết định của Đội ngũ Nova ---------- */

function DecisionCard({ m }: { m: Message }) {
  const { state } = useStore();
  const ws = state.workspaces[m.refs!.workspaceId!];
  const ms = ws.milestones.find((x) => x.id === m.refs?.milestoneId)!;
  const p = ms.payout!;
  const title = { release: "Giải ngân cho freelancer", refund: "Hoàn tiền cho business", split: "Chia tiền" }[p.decision];
  return (
    <div className="rounded-2xl bg-[#14242a]/95 px-4 py-3 ring-1 ring-cyan/30">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-cyan/15 text-cyan">
          <Gavel size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan">Đội ngũ Nova · Quyết định</p>
          <p className="text-[16px] font-semibold">{title}</p>
        </div>
        <StatusBadge status={ms.status} />
      </div>
      <dl className="mt-3 space-y-1 rounded-xl bg-black/25 p-3 text-[13px]">
        <Row k="Milestone" v={usdc(ms.amount)} />
        <Row k="Phần freelancer" v={usdc(p.freelancerGross)} />
        <Row k={`Replyn fee dự kiến (${Math.round(FEE_RATE[ws.feeTier] * 100)}%, mô phỏng)`} v={`− ${usdc(p.fee)}`} />
        <Row k="Freelancer nhận dự kiến" v={usdc(p.freelancerNet)} strong />
        <Row k="Business hoàn dự kiến" v={usdc(p.businessRefund)} strong />
      </dl>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-2">
        <RefreshCw size={12} /> Quyết định dựa trên điều khoản đã khóa, các bản nộp và lịch sử trao đổi. Số tiền là mô phỏng.
      </p>
      <p className="mt-1 text-right text-[11px] text-muted">{hhmm(m.at)}</p>
    </div>
  );
}
