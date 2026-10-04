/** Dấu nhận diện Nova (tự vẽ): ngôi sao bốn cánh trên nền than, hòa vào hệ màu Replyn thay vì xanh Nova. */
export function NovaMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2a3942" />
      <path d="M16 6.5c.7 4.6 2.9 6.8 7.5 7.5v.2c-4.6.7-6.8 2.9-7.5 7.5h-.2c-.7-4.6-2.9-6.8-7.5-7.5V14c4.6-.7 6.8-2.9 7.5-7.5z" fill="#e9edef" />
      <circle cx="23.5" cy="23.5" r="2" fill="#e9edef" opacity=".6" />
    </svg>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Dấu tick vẽ nét ngắn khi xác thực thành công (tắt theo prefers-reduced-motion). */
export function SuccessCheck({ size = 44 }: { size?: number }) {
  return (
    <span className="na-check grid shrink-0 place-items-center rounded-full bg-(--na-success)/15 text-(--na-success)" style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Tiêu đề + các bước hướng dẫn, dùng chung cho cột giải thích của cả hai phương thức. */
export function GuideSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <>
      <h2 className="text-[17px] font-semibold text-(--na-ink)">{title}</h2>
      <ol className="mt-4 space-y-3.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 text-[15px] text-(--na-ink-2)">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--na-raised) text-[12px] font-semibold text-(--na-ink)">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5 text-pretty">{s}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Link phụ trung tính (không dùng xanh Nova), focus ring vàng Replyn. */
export const linkClass =
  "rounded text-[14px] font-medium text-(--na-ink) underline decoration-(--na-muted) underline-offset-[3px] hover:decoration-(--na-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--na-accent)";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--na-accent)";
