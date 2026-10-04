import type { HandoffInfo } from "@/lib/auth/mockNova";

/** Thông tin cuộc trò chuyện được chuyển từ Nova. Chỉ metadata, không hiển thị nội dung tin nhắn. */
export function HandoffSummary({ info }: { info: HandoffInfo }) {
  return (
    <section aria-label="Cuộc trò chuyện được chuyển từ Nova" className="flex items-center gap-3 rounded-lg bg-(--na-subtle) px-3.5 py-3">
      <div className="flex shrink-0 -space-x-1" aria-hidden>
        {info.members.slice(0, 2).map((m) => (
          <span
            key={m.id}
            className="grid size-9 place-items-center rounded-full bg-(--na-raised) text-[13px] font-semibold ring-2 ring-(--na-subtle)"
            style={{ color: m.color }}
          >
            {m.initials}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold text-(--na-ink)">
          <span className="truncate">{info.project ?? info.title}</span>
          {/* điểm nhấn vàng duy nhất của vùng handoff */}
          <span className="inline-flex items-center gap-1.5 rounded bg-(--na-raised) px-1.5 py-px text-[11px] font-medium text-(--na-ink-2)">
            <span className="size-1.5 rounded-full bg-(--na-accent)" aria-hidden /> Từ Nova Chat
          </span>
        </p>
        <p className="truncate text-[13px] text-(--na-ink-2)">{info.members.map((m) => m.name).join(" · ")}</p>
        <p className="mt-0.5 text-[13px] text-(--na-muted)">Sau khi đăng nhập, bạn sẽ được đưa thẳng tới cuộc trò chuyện này.</p>
      </div>
    </section>
  );
}
