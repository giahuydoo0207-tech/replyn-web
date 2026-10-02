"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/reducer";
import type { MilestoneStatus } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Logo Replyn: bubble + dấu tick, không mượn brand nào ---------- */
export function ReplynMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#FFD33D" />
      <path
        d="M11 12.5c0-1.4 1.1-2.5 2.5-2.5h13c1.4 0 2.5 1.1 2.5 2.5v10c0 1.4-1.1 2.5-2.5 2.5H19l-5.2 4.3c-.5.4-1.3 0-1.3-.6V25h-.9C10.6 25 11 24 11 22.5z"
        fill="#0B0D0A"
      />
      <path d="m15.5 17.6 3 3 6-6" stroke="#FFD33D" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({
  initials,
  bg,
  fg,
  size = 48,
  ring,
}: {
  initials: string;
  bg: string;
  fg: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-semibold select-none",
        ring && "ring-2 ring-white/15",
      )}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

const TONE: Record<string, string> = {
  yellow: "bg-yellow/15 text-yellow ring-yellow/30",
  amber: "bg-amber/15 text-amber ring-amber/30",
  success: "bg-success/12 text-success ring-success/30",
  danger: "bg-danger/15 text-danger ring-danger/35",
  cyan: "bg-cyan/12 text-cyan ring-cyan/30",
  muted: "bg-white/5 text-ink-2 ring-white/10",
};

export type Tone = keyof typeof TONE;

export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<MilestoneStatus, Tone> = {
  awaiting_funding: "muted",
  funded_sim: "yellow",
  submitted: "cyan",
  in_review: "cyan",
  revision_requested: "amber",
  ready_to_release: "success",
  disputed: "danger",
  released_sim: "success",
  refunded: "amber",
  split: "yellow",
};

const DOT: Record<Tone, string> = {
  yellow: "bg-yellow",
  amber: "bg-amber",
  success: "bg-success",
  danger: "bg-danger",
  cyan: "bg-cyan",
  muted: "bg-muted",
};

/** Pill trung tính + chấm màu: màu chỉ nằm ở chấm, không tô cả khối */
export function StatusBadge({ status, className }: { status: MilestoneStatus; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/6 px-2 py-0.5 text-xs font-medium text-ink-2",
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full", DOT[STATUS_TONE[status]])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-yellow disabled:opacity-40",
        active && "bg-white/10 text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-yellow text-[#0B0D0A] hover:bg-[#f7d064] font-semibold",
  secondary: "bg-white/6 text-ink hover:bg-white/10",
  danger: "bg-white/6 text-[#ff8f8f] hover:bg-danger/15",
  ghost: "text-ink-2 hover:bg-white/6 hover:text-ink",
};

export function Button({
  variant = "secondary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow disabled:cursor-not-allowed disabled:opacity-40",
        BTN[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="msg-in w-full max-w-md rounded-2xl bg-panel ring-1 ring-line shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-lg font-bold">{title}</h2>
          <IconButton label="Đóng" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
