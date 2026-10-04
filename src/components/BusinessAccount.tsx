"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/reducer";
import { useBusinessSession } from "@/lib/store";
import { Avatar, cx } from "./ui";

/**
 * Tài khoản Nova Business đã xác minh (từ cookie phiên do server ký) và lệnh đăng xuất thật.
 * Chỉ hiển thị khi có phiên; dữ liệu chat vẫn là dữ liệu mẫu nên không gán tin nhắn cũ cho danh tính này.
 */
export function BusinessAccount({ className }: { className?: string }) {
  const { identity, signOut } = useBusinessSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!identity) return null;

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    // thành công thì trang chuyển sang /auth/nova nên giữ trạng thái "đang đăng xuất"
    if (!(await signOut())) {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <section aria-label="Tài khoản Nova Business" className={cx("rounded-xl bg-rail p-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(identity.displayName)} bg="#233138" fg="#FFB65C" size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{identity.displayName}</p>
          <p className="truncate font-mono text-xs text-ink-2">{identity.publicNovaId}</p>
        </div>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <ShieldCheck size={14} className="shrink-0 text-yellow" aria-hidden /> Nova Business đã xác minh
      </p>
      <p className="mt-1 text-xs text-muted">Nội dung trò chuyện hiện là dữ liệu demo.</p>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/6 text-sm font-medium text-ink hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/40 disabled:cursor-progress disabled:opacity-70"
      >
        <LogOut size={16} aria-hidden /> {busy ? "Đang đăng xuất…" : "Đăng xuất Nova"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Chưa đăng xuất được. Kiểm tra kết nối rồi thử lại.
        </p>
      )}
    </section>
  );
}
