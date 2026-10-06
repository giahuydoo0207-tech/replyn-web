"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/reducer";
import { useNovaSession } from "@/lib/store";
import { Avatar, cx } from "./ui";

/**
 * Tài khoản Nova đã xác minh (từ cookie phiên do server ký) và lệnh đăng xuất thật: Business đăng nhập bằng
 * Nova ID, Talent đăng nhập bằng mã QR trên Nova Mobile. Chỉ hiển thị khi có phiên; phiên thật chỉ có workspace
 * thật từ Nova, không có dữ liệu mẫu. Talent không có Nova ID nên không hiển thị mã nào.
 */
export function NovaAccount({ className }: { className?: string }) {
  const { identity, signOut } = useNovaSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!identity) return null;
  const business = identity.role === "business";

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
    <section aria-label={business ? "Tài khoản Nova Business" : "Tài khoản Nova"} className={cx("rounded-xl bg-rail p-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(identity.displayName)} bg="#233138" fg="#FFB65C" size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{identity.displayName}</p>
          <p className={cx("truncate text-xs text-ink-2", business && "font-mono")}>{business ? identity.publicNovaId : "Freelancer"}</p>
        </div>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <ShieldCheck size={14} className="shrink-0 text-yellow" aria-hidden />
        {business ? "Nova Business đã xác minh" : "Nova Mobile đã xác minh"}
      </p>
      <p className="mt-1 text-xs text-muted">Các thao tác trong workspace là mô phỏng và chỉ lưu trên trình duyệt này.</p>
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
