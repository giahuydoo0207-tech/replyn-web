"use client";

import { useSyncExternalStore } from "react";

/**
 * Chỉ lưu lựa chọn "ghi nhớ thiết bị", không lưu Nova ID, Nova Key hay token.
 * Với Nova ID, lựa chọn này chỉ quyết định cookie phiên còn lại sau khi đóng trình duyệt hay không.
 */
const KEY = "replyn.auth.remember-device";
const listeners = new Set<() => void>();

export function readRememberDevice(): boolean {
  return read();
}

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function write(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    // bỏ qua khi localStorage bị chặn
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function RememberDevice() {
  const checked = useSyncExternalStore(subscribe, read, () => true);
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[14px] text-(--na-ink-2)">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => write(e.target.checked)}
        className="size-4 accent-(--na-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--na-accent)"
      />
      Ghi nhớ thiết bị này
    </label>
  );
}
