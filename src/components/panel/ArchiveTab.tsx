"use client";

import { Archive, ArrowUpRight, Paperclip, Undo2 } from "lucide-react";
import { useState } from "react";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { findAttachment, NOVA_TEAM_ID, SYSTEM_ID } from "@/lib/reducer";
import { jumpToMessage, useStore } from "@/lib/store";
import type { Message, Workspace } from "@/lib/types";
import { cx } from "../ui";

type Filter = "all" | "files" | "recalled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "files", label: "Tệp" },
  { id: "recalled", label: "Đã thu hồi" },
];

/** Tin của người dùng (không tính thông báo hệ thống), theo thứ tự thời gian. */
const saved = (list: Message[] | undefined) =>
  (list ?? []).filter(
    (m) => ["text", "file", "submission"].includes(m.kind) && m.senderId !== SYSTEM_ID && m.senderId !== NOVA_TEAM_ID,
  );

/**
 * Kho lưu trữ tin nhắn của dự án: chỉ xem, chỉ ghi thêm. Tin đã thu hồi vẫn giữ nội dung kèm nhãn để hai bên đối chiếu.
 * Chương 1 là trao đổi trước khi chốt thỏa thuận, chương 2 là hội thoại trong workspace.
 */
export function ArchiveTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const wsChat = Object.values(state.conversations).find((c) => c.workspaceId === ws.id);
  const before = saved(wsChat?.sourceNovaChatId ? state.messages[wsChat.sourceNovaChatId] : undefined);
  const during = saved(wsChat ? state.messages[wsChat.id] : undefined);
  const keep = (m: Message) =>
    filter === "all" || (filter === "files" ? m.kind !== "text" : !!m.recalledAt);
  const chapters = [
    { id: "before", title: "Chương 1 · Trao đổi trước khi chốt", hint: "Chỉ xem", messages: before.filter(keep), live: false },
    { id: "during", title: "Chương 2 · Trong workspace", hint: "Tự động lưu khi gửi", messages: during.filter(keep), live: true },
  ].filter((c) => c.id === "during" || before.length > 0);
  const total = before.length + during.length;
  const recalled = [...before, ...during].filter((m) => m.recalledAt).length;

  const open = (m: Message) => {
    if (wsChat && state.ui.activeChatId !== wsChat.id) dispatch({ type: "SELECT_CHAT", chatId: wsChat.id });
    jumpToMessage(dispatch, m.id);
  };

  return (
    <div>
      <div className="rounded-xl bg-panel p-4">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold">
          <Archive size={16} className="text-ink-2" /> Lưu trữ tin nhắn
        </h3>
        <p className="mt-1 text-[13px] text-ink-2">
          Mọi tin nhắn trong dự án được lưu lại theo thời gian. Thu hồi chỉ ẩn tin khỏi cuộc trò chuyện; bản lưu ở đây vẫn giữ
          nội dung để hai bên đối chiếu.
        </p>
        <p className="mt-2 text-xs text-muted">
          {total} tin nhắn · {recalled} đã thu hồi · Lưu trên trình duyệt này (mô phỏng)
        </p>
      </div>

      <div role="group" aria-label="Lọc tin nhắn" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              "h-8 rounded-full px-3 text-[13px]",
              filter === f.id ? "bg-yellow/15 font-medium text-yellow" : "bg-white/6 text-ink-2 hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {chapters.map((chapter) => (
        <section key={chapter.id} aria-label={chapter.title} className="mt-5">
          <h4 className="flex items-baseline justify-between gap-2 border-b border-line pb-2 text-sm font-semibold">
            {chapter.title}
            <span className="text-xs font-normal text-muted">{chapter.hint}</span>
          </h4>
          {chapter.messages.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">
              {filter === "all" ? "Chưa có tin nhắn nào." : "Không có tin nhắn khớp bộ lọc."}
            </p>
          ) : (
            <ol>
              {chapter.messages.map((m) => (
                <ArchiveRow key={m.id} m={m} onOpen={chapter.live && !m.recalledAt ? () => open(m) : undefined} />
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

function ArchiveRow({ m, onOpen }: { m: Message; onOpen?: () => void }) {
  const { state } = useStore();
  const sender = state.users[m.senderId];
  const file = m.kind !== "text" ? findAttachment(state, m.refs?.attachmentId) : undefined;
  return (
    <li className={cx("grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 border-b border-line py-2.5", !!m.recalledAt && "bg-white/[0.02]")}>
      <time className="pt-0.5 text-[12px] tabular-nums text-muted" dateTime={new Date(m.at).toISOString()} title={ddmmyyyy(m.at)}>
        {hhmm(m.at)}
      </time>
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: sender?.color }}>{sender?.name ?? "Người dùng"}</p>
        {file && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink">
            <Paperclip size={14} className="shrink-0 text-ink-2" />
            <span className="truncate">{file.name}</span>
          </p>
        )}
        {m.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] text-ink">{m.text}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {m.recalledAt && (
            <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
              <Undo2 size={12} /> Đã thu hồi lúc {hhmm(m.recalledAt)}
            </span>
          )}
          {onOpen && (
            <button type="button" onClick={onOpen} className="inline-flex items-center gap-0.5 text-[12px] text-link hover:underline">
              Xem trong chat <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
