"use client";

import { KeyRound, QrCode } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cx } from "../ui";

export type AuthMethod = "qr" | "id";

const TABS: { id: AuthMethod; label: string; icon: typeof KeyRound }[] = [
  { id: "id", label: "Nova ID", icon: KeyRound },
  { id: "qr", label: "Mã QR", icon: QrCode },
];

export const tabId = (m: AuthMethod) => `nova-auth-tab-${m}`;
export const panelId = (m: AuthMethod) => `nova-auth-panel-${m}`;

/** Segmented control hai phương thức; ←/→/Home/End chuyển tab theo mẫu WAI-ARIA tabs. Tab active nền vàng Replyn. */
export function AuthMethodTabs({ value, onChange }: { value: AuthMethod; onChange: (m: AuthMethod) => void }) {
  const refs = useRef<Record<AuthMethod, HTMLButtonElement | null>>({ id: null, qr: null });
  const index = TABS.findIndex((t) => t.id === value);

  const onKeyDown = (e: KeyboardEvent) => {
    const next =
      e.key === "ArrowRight" ? (index + 1) % TABS.length
      : e.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-label="Phương thức đăng nhập" onKeyDown={onKeyDown} className="relative grid grid-cols-2 rounded-lg bg-(--na-bg) p-1 ring-1 ring-(--na-border)">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-(--na-accent) transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {TABS.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              "relative z-10 flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--na-accent)",
              selected ? "text-(--na-on-accent)" : "text-(--na-ink-2) hover:text-(--na-ink)",
            )}
          >
            <t.icon size={17} aria-hidden />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
