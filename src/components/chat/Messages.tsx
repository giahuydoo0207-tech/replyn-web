"use client";

import { CheckCheck, Lock, Pin, PinOff, ShieldCheck, Undo2 } from "lucide-react";
import { Fragment, useState } from "react";
import { dayKey, dayLabel, hhmm } from "@/lib/format";
import { noticeText, previewOf } from "@/lib/preview";
import { canPin, canRecall, findAttachment, keepsRecalled, initials, NOVA_TEAM_ID, SYSTEM_ID, type PanelTab } from "@/lib/reducer";
import { jumpToMessage, useMe, useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { FilePreview } from "../FileCard";
import { LinkedText } from "../LinkedText";
import { ChangeCard } from "../panel/ScopeChange";
import { Avatar, cx } from "../ui";

const GROUP_GAP = 5 * 60 * 1000;
const NOTICE_KINDS = ["system", "milestone", "payment", "dispute", "decision"];
const isNotice = (m: Message) => NOTICE_KINDS.includes(m.kind) || m.senderId === SYSTEM_ID || m.senderId === NOVA_TEAM_ID;

const LINK_LABEL: Record<PanelTab, string> = {
  archive: "Xem lưu trữ",
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
  if (m.kind === "change") return <ChangeInChat m={m} flash={flash} />;
  if (m.recalledAt) return <RecalledLine m={m} flash={flash} />;

  const out = m.senderId === meId;
  const sender = state.users[m.senderId];
  const showName = !out && showAvatars && first;

  const bubble = (
    <div
      id={`msg-${m.id}`}
      className={cx("group msg-in flex items-end gap-2", out ? "justify-end" : "justify-start", first && "mt-1.5")}
    >
      {!out && showAvatars && (
        <div className="w-8 shrink-0">
          {last && sender && <Avatar initials={initials(sender.name)} bg="#233138" fg={sender.color} size={32} />}
        </div>
      )}
      {out && canRecall(state, m) && <RecallButton m={m} />}
      {out && canPin(state, m) && <PinButton m={m} />}
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
        <Meta at={m.at} out={out} pinned={!!m.pinnedAt} />
      </div>
      {!out && canPin(state, m) && <PinButton m={m} />}
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

/** Đề xuất đổi phạm vi hiện thành thẻ rộng giữa khung chat, có nút trả lời ngay tại chỗ. */
function ChangeInChat({ m, flash }: { m: Message; flash: boolean }) {
  const { state } = useStore();
  const ws = m.refs?.workspaceId ? state.workspaces[m.refs.workspaceId] : undefined;
  const change = ws?.changes?.find((c) => c.id === m.refs?.changeId);
  if (!ws || !change) return null;
  return (
    <div id={`msg-${m.id}`} className="msg-in mx-auto my-2 w-full max-w-[560px]">
      <ChangeCard ws={ws} change={change} flash={flash} />
    </div>
  );
}

/** Trong chat chỉ còn một dòng; nội dung gốc nằm trong tab Lưu trữ. */
function RecalledLine({ m, flash }: { m: Message; flash: boolean }) {
  const { state } = useStore();
  const meId = useMe();
  const who = m.senderId === meId ? "Bạn" : state.users[m.senderId]?.name ?? "Người gửi";
  return (
    <div id={`msg-${m.id}`} className="my-1 flex justify-center">
      <p className={cx("inline-flex items-center gap-1.5 rounded-lg bg-notice/95 px-3 py-1 text-[13px] italic text-ink-2", flash && "flash")}>
        <Undo2 size={13} className="shrink-0" aria-hidden />
        {who} đã thu hồi một tin nhắn · {hhmm(m.recalledAt!)}
      </p>
    </div>
  );
}

/** Thu hồi tin của chính mình: xác nhận ngay tại chỗ, báo rõ bản lưu vẫn còn. */
function RecallButton({ m }: { m: Message }) {
  const { state, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div role="alertdialog" aria-label="Thu hồi tin nhắn" className="msg-in mb-1 max-w-[260px] rounded-lg bg-panel p-2.5 text-[12px] text-ink-2 shadow-xl ring-1 ring-line">
        <p>
          {keepsRecalled(state, m)
            ? "Tin nhắn sẽ ẩn khỏi cuộc trò chuyện với cả hai bên nhưng vẫn được giữ trong Lưu trữ dự án để đối chiếu."
            : "Tin nhắn sẽ biến mất với mọi người trong nhóm, không để lại dấu vết."}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirm(false)} className="rounded-md px-2.5 py-1 hover:bg-white/8">Hủy</button>
          <button
            type="button"
            autoFocus
            onClick={() => dispatch({ type: "RECALL_MESSAGE", chatId: m.chatId, messageId: m.id })}
            className="rounded-md bg-danger/15 px-2.5 py-1 font-medium text-danger hover:bg-danger/25"
          >
            Thu hồi
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label="Thu hồi tin nhắn"
      title="Thu hồi tin nhắn"
      onClick={() => setConfirm(true)}
      className="mb-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-2 opacity-60 hover:bg-white/8 hover:text-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
    >
      <Undo2 size={16} />
    </button>
  );
}

/** Ghim như ghim tin nhắn thường: một chạm, bấm lại để bỏ ghim. */
function PinButton({ m }: { m: Message }) {
  const { dispatch } = useStore();
  const label = m.pinnedAt ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!!m.pinnedAt}
      title={label}
      onClick={() => dispatch({ type: "TOGGLE_MESSAGE_PIN", chatId: m.chatId, messageId: m.id })}
      className={cx(
        "mb-1 grid size-8 shrink-0 place-items-center rounded-full transition-[transform,opacity] hover:bg-white/8 hover:text-ink focus-visible:opacity-100 active:scale-90 md:group-hover:opacity-100",
        m.pinnedAt ? "text-yellow opacity-80 md:opacity-0" : "text-ink-2 opacity-60 md:opacity-0",
      )}
    >
      {m.pinnedAt ? <PinOff size={16} /> : <Pin size={16} />}
    </button>
  );
}

function Meta({ at, out, pinned }: { at: number; out: boolean; pinned?: boolean }) {
  return (
    <span className="float-right ml-3 mt-1.5 inline-flex translate-y-1 items-center gap-1 text-[11px] leading-none text-ink-2/70">
      {pinned && <Pin size={11} className="rotate-45 text-yellow" aria-label="Đã ghim" />}
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
        {m.text && <p className="mt-1 whitespace-pre-wrap break-words"><LinkedText text={m.text} /></p>}
      </>
    );
  }
  return <span className="whitespace-pre-wrap break-words"><LinkedText text={m.text ?? ""} /></span>;
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
