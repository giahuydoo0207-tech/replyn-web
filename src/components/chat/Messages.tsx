"use client";

import { ArrowRight, CheckCheck, Lock, ShieldCheck } from "lucide-react";
import { Fragment } from "react";
import { FEE_LABEL, usdc } from "@/lib/fees";
import { dayKey, dayLabel, hhmm } from "@/lib/format";
import { noticeText, previewOf } from "@/lib/preview";
import { findAttachment, initials, NOVA_TEAM_ID, SYSTEM_ID, type PanelTab } from "@/lib/reducer";
import { jumpToMessage, useMe, useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { FilePreview } from "../FileCard";
import { Avatar, Button, cx, ReplynMark } from "../ui";

const GROUP_GAP = 5 * 60 * 1000;
const NOTICE_KINDS = ["system", "milestone", "payment", "dispute", "decision"];
const isNotice = (m: Message) => NOTICE_KINDS.includes(m.kind) || m.senderId === SYSTEM_ID || m.senderId === NOVA_TEAM_ID;

const LINK_LABEL: Record<PanelTab, string> = {
  terms: "Xem điều khoản",
  milestones: "Xem tiến độ",
  files: "Xem file",
  evidence: "Xem bằng chứng",
  dispute: "Xem hỗ trợ",
};

export function MessageList({ conv, messages }: { conv: Conversation; messages: Message[] }) {
  const { state } = useStore();
  const showAvatars = conv.kind !== "nova";
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[3px] px-3 pb-4 pt-3 sm:px-8">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
        const sameAsPrev = !newDay && prev && prev.senderId === m.senderId && !isNotice(prev) && m.at - prev.at < GROUP_GAP;
        const sameAsNext =
          next && dayKey(next.at) === dayKey(m.at) && next.senderId === m.senderId && !isNotice(next) && next.at - m.at < GROUP_GAP;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="my-2 flex justify-center">
                <span className="rounded-md bg-notice/95 px-2.5 py-1 text-xs font-medium text-ink-2 shadow-sm">
                  {dayLabel(m.at, state.clock)}
                </span>
              </div>
            )}
            <MessageRow m={m} first={!sameAsPrev} last={!sameAsNext} showAvatars={showAvatars} />
          </Fragment>
        );
      })}
    </div>
  );
}

function MessageRow({
  m,
  first,
  last,
  showAvatars,
}: {
  m: Message;
  first: boolean;
  last: boolean;
  showAvatars: boolean;
}) {
  const { state } = useStore();
  const meId = useMe();
  const flash = state.ui.flashId === m.id;

  if (isNotice(m)) return <Notice m={m} flash={flash} />;

  const out = m.senderId === meId;
  const sender = state.users[m.senderId];
  const showName = !out && showAvatars && first;

  if (m.kind === "proposal") {
    return (
      <div id={`msg-${m.id}`} className={cx("msg-in my-1.5 flex", out ? "justify-end" : "justify-start")}>
        <div className={cx("w-[min(420px,88%)] rounded-xl", flash && "flash")}>
          <ProposalCard m={m} />
        </div>
      </div>
    );
  }

  const bubble = (
    <div
      id={`msg-${m.id}`}
      className={cx("msg-in flex items-end gap-2", out ? "justify-end" : "justify-start", first && "mt-1.5")}
    >
      {!out && showAvatars && (
        <div className="w-8 shrink-0">
          {last && sender && <Avatar initials={initials(sender.name)} bg="#233138" fg={sender.color} size={32} />}
        </div>
      )}
      <div
        className={cx(
          "relative max-w-[min(540px,82%)] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[15px] leading-[1.4] shadow-[0_1px_0.5px_rgb(0_0_0/0.35)]",
          out ? "bg-bubble-out" : "bg-bubble-in",
          first && (out ? "rounded-tr-sm" : "rounded-tl-sm"),
          flash && "flash",
        )}
      >
        {showName && sender && (
          <p className="mb-0.5 text-[13px] font-semibold" style={{ color: sender.color }}>
            {sender.name}
          </p>
        )}
        {m.replyToId && <ReplyQuote id={m.replyToId} chatId={m.chatId} />}
        <Body m={m} out={out} />
        <Meta at={m.at} out={out} />
      </div>
    </div>
  );

  // nộp file: bubble của freelancer (file gọn + ghi chú) và 1 dòng notice ngay dưới
  if (m.kind === "submission") {
    return (
      <>
        {bubble}
        <Notice m={m} flash={false} anchor={false} />
      </>
    );
  }
  return bubble;
}

function Meta({ at, out }: { at: number; out: boolean }) {
  return (
    <span className="float-right ml-3 mt-1.5 inline-flex translate-y-1 items-center gap-1 text-[11px] leading-none text-ink-2/70">
      {hhmm(at)}
      {out && <CheckCheck size={15} className="text-[#53bdeb]" aria-label="Đã xem" />}
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
      className="mb-1 block w-full rounded border-l-[3px] bg-black/20 py-1 pl-2 pr-2 text-left hover:bg-black/30"
      style={{ borderColor: u?.color ?? "#aebac1" }}
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
  if (m.kind === "file" || m.kind === "submission") {
    const a = findAttachment(state, m.refs?.attachmentId);
    return (
      <>
        {a && <FilePreview a={a} out={out} />}
        {m.text && <p className="mt-1 whitespace-pre-wrap break-words">{m.text}</p>}
      </>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{m.text}</span>;
}

/* ---------- Notice 1 dòng + link mở tab panel ---------- */

function Notice({ m, flash, anchor = true }: { m: Message; flash: boolean; anchor?: boolean }) {
  const { state, dispatch } = useStore();
  const nova = m.senderId === NOVA_TEAM_ID || m.kind === "decision";
  const danger = m.kind === "dispute";
  return (
    <div id={anchor ? `msg-${m.id}` : undefined} className="msg-in my-1 flex justify-center px-4">
      {/* notice là một đoạn text inline nên xuống dòng tự nhiên, icon không bị tách dòng */}
      <p
        className={cx(
          "max-w-[600px] rounded-lg bg-notice/95 px-3 py-1.5 text-center text-[13px] leading-snug text-ink-2 shadow-sm",
          flash && "flash",
        )}
      >
        {nova ? (
          <ShieldCheck size={14} className="mr-1.5 inline-block align-[-2px] text-ink-2" />
        ) : danger ? (
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-danger align-[2px]" />
        ) : m.link === "terms" ? (
          <Lock size={13} className="mr-1.5 inline-block align-[-2px]" />
        ) : null}
        <span className="text-ink/90">{noticeText(state, m)}</span>
        {m.link && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_PANEL", tab: m.link, open: true })}
              className="font-medium text-ink underline decoration-white/25 underline-offset-2 hover:decoration-white/70"
            >
              {LINK_LABEL[m.link]}
            </button>
          </>
        )}
        <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted">{hhmm(m.at)}</span>
      </p>
    </div>
  );
}
/* ---------- Proposal (Nova Chat) ---------- */

function ProposalCard({ m }: { m: Message }) {
  const { state, dispatch } = useStore();
  const conv = state.conversations[m.chatId];
  const p = conv.proposal!;
  const total = p.milestones.reduce((a, x) => a + x.amount, 0);
  const status = conv.proposalStatus ?? "pending";
  const statusLabel = { pending: "Đang chờ phản hồi", opened: "Đã được mở", later: "Đã để sau" }[status];
  const dot = { pending: "bg-amber", opened: "bg-success", later: "bg-muted" }[status];
  return (
    <div className="overflow-hidden rounded-xl bg-panel ring-1 ring-line">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <ReplynMark size={30} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Đề xuất chuyển sang Replyn</p>
          <p className="text-xs text-muted">
            {state.users[m.senderId].name} · {hhmm(m.at)}
          </p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[14px] leading-relaxed text-ink-2">
          Chuyển cuộc trao đổi này sang workspace Replyn để khóa điều khoản, tạo milestone, nộp sản phẩm, nghiệm thu và theo
          dõi bằng chứng dự án.
        </p>
        <dl className="divide-y divide-white/5 rounded-lg bg-black/20 text-[13px]">
          <Row k="Dự án" v={p.projectTitle} />
          <Row k="Tổng giá trị" v={usdc(total)} />
          <Row k="Giai đoạn" v={`${p.milestones.length} giai đoạn`} />
          <Row k="Gói phí" v={FEE_LABEL[p.feeTier]} />
        </dl>
        <p className="border-l-2 border-white/15 pl-2.5 text-[13px] italic text-ink-2">
          Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.
        </p>
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span className="rounded bg-white/6 px-1.5 py-0.5">Demo: escrow mô phỏng</span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx("size-1.5 rounded-full", dot)} />
            {statusLabel}
          </span>
        </div>
        {status !== "opened" && (
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => dispatch({ type: "OPEN_REPLYN", chatId: conv.id })}>
              Mở Replyn <ArrowRight size={16} />
            </Button>
            {status === "pending" && (
              <Button variant="secondary" onClick={() => dispatch({ type: "PROPOSAL_LATER", chatId: conv.id })}>
                Để sau
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
