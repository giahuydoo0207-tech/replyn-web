"use client";

import { Archive, ArrowUpRight, Film, Image as ImageIcon, Link2, Paperclip, Pin, Undo2, type LucideIcon } from "lucide-react";
import { type ArchiveFilter, extractLinks, isMedia, isVideoName, matchesFilter } from "@/lib/archive";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { findAttachment, NOVA_TEAM_ID, SYSTEM_ID } from "@/lib/reducer";
import { jumpToMessage, useStore } from "@/lib/store";
import type { Message, Workspace } from "@/lib/types";
import { LinkedText } from "../LinkedText";
import { cx } from "../ui";

const FILTERS: { id: ArchiveFilter; label: string; icon: LucideIcon; empty: string; hint?: string }[] = [
  { id: "all", label: "Tất cả", icon: Archive, empty: "Chưa có tin nhắn nào" },
  { id: "files", label: "Tệp", icon: Paperclip, empty: "Chưa có tệp nào", hint: "Tệp gửi trong chat sẽ tự xuất hiện ở đây." },
  { id: "links", label: "Liên kết", icon: Link2, empty: "Chưa có liên kết nào", hint: "Liên kết dán trong chat sẽ tự xuất hiện ở đây." },
  { id: "media", label: "Ảnh & video", icon: ImageIcon, empty: "Chưa có ảnh hoặc video nào", hint: "Ảnh và video gửi trong chat sẽ tự xuất hiện ở đây." },
  { id: "pinned", label: "Đã ghim", icon: Pin, empty: "Chưa ghim tin nào", hint: "Rê chuột vào một tin nhắn trong chat rồi bấm biểu tượng ghim." },
  { id: "recalled", label: "Đã thu hồi", icon: Undo2, empty: "Không có tin nào bị thu hồi" },
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
  const filter = state.ui.archiveFilter ?? "all";
  const setFilter = (f: ArchiveFilter) => dispatch({ type: "SET_PANEL", archiveFilter: f });
  const wsChat = Object.values(state.conversations).find((c) => c.workspaceId === ws.id);
  const before = saved(wsChat?.sourceNovaChatId ? state.messages[wsChat.sourceNovaChatId] : undefined);
  const during = saved(wsChat ? state.messages[wsChat.id] : undefined);
  const attachmentOf = (m: Message) => (m.kind !== "text" ? findAttachment(state, m.refs?.attachmentId) : undefined);
  const count = (f: ArchiveFilter) => [...before, ...during].filter((m) => matchesFilter(f, m, attachmentOf(m))).length;
  const keep = (m: Message) => matchesFilter(filter, m, attachmentOf(m));
  const current = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const chapters = [
    { id: "before", title: "Chương 1 · Trao đổi trước khi chốt", hint: "Chỉ xem", messages: before.filter(keep), live: false },
    { id: "during", title: "Chương 2 · Trong workspace", hint: "Tự động lưu khi gửi", messages: during.filter(keep), live: true },
  ].filter((c) => c.id === "during" || before.length > 0);
  const total = before.length + during.length;
  const recalled = count("recalled");
  const pinned = count("pinned");

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
          {total} tin nhắn · {pinned} đã ghim · {recalled} đã thu hồi · Lưu trên trình duyệt này (mô phỏng)
        </p>
      </div>

      <div role="group" aria-label="Lọc tin nhắn" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? total : count(f.id);
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-[background-color,color,transform] duration-200 active:scale-[0.98]",
                on ? "bg-yellow/15 font-medium text-yellow" : "bg-white/6 text-ink-2 hover:bg-white/10 hover:text-ink",
              )}
            >
              {f.label}
              {n > 0 && <span className={cx("tabular-nums text-[12px]", on ? "text-yellow/75" : "text-muted")}>{n}</span>}
            </button>
          );
        })}
      </div>

      {chapters.map((chapter) => (
        <section key={chapter.id} aria-label={chapter.title} className="mt-5">
          <h4 className="flex items-baseline justify-between gap-2 border-b border-line pb-2 text-sm font-semibold">
            {chapter.title}
            <span className="text-xs font-normal text-muted">{chapter.hint}</span>
          </h4>
          {chapter.messages.length === 0 ? (
            <EmptyState icon={current.icon} title={current.empty} hint={chapter.live ? current.hint : undefined} />
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

/** Trạng thái trống có hướng dẫn thao tác, thay cho một dòng chữ mờ. */
function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="seal-reveal flex items-start gap-3 py-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-muted ring-1 ring-inset ring-white/[0.06]">
        <Icon size={18} />
      </span>
      <div className="pt-0.5">
        <p className="text-[14px] font-medium text-ink-2">{title}</p>
        {hint && <p className="mt-0.5 max-w-[52ch] text-[13px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function ArchiveRow({ m, onOpen }: { m: Message; onOpen?: () => void }) {
  const { state } = useStore();
  const sender = state.users[m.senderId];
  const file = m.kind !== "text" ? findAttachment(state, m.refs?.attachmentId) : undefined;
  const FileIcon = !isMedia(file) ? Paperclip : file && isVideoName(file.name) ? Film : ImageIcon;
  const links = extractLinks(m.text).length;
  const isPinned = !!m.pinnedAt && !m.recalledAt;
  return (
    <li
      className={cx(
        "grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 border-b border-line py-2.5",
        !!m.recalledAt && "bg-white/[0.02]",
        isPinned && "shadow-[inset_2px_0_0_var(--color-yellow)] pl-2",
      )}
    >
      <time className="pt-0.5 text-[12px] tabular-nums text-muted" dateTime={new Date(m.at).toISOString()} title={ddmmyyyy(m.at)}>
        {hhmm(m.at)}
      </time>
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: sender?.color }}>{sender?.name ?? "Người dùng"}</p>
        {file && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink">
            <FileIcon size={14} className="shrink-0 text-ink-2" />
            <span className="truncate">{file.name}</span>
          </p>
        )}
        {m.text && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] text-ink">
            <LinkedText text={m.text} />
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isPinned && (
            <span className="inline-flex items-center gap-1 rounded bg-yellow/15 px-1.5 py-0.5 text-[11px] font-medium text-yellow">
              <Pin size={12} className="rotate-45" /> Đã ghim
            </span>
          )}
          {links > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Link2 size={12} /> {links} liên kết
            </span>
          )}
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
