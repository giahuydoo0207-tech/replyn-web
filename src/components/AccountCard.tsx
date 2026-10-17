"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { initials } from "@/lib/reducer";
import { useAccount } from "@/lib/store";
import { Avatar, cx } from "./ui";

/** Tài khoản đang đăng nhập (từ cookie phiên do server ký) và nút đăng xuất. */
export function AccountCard({ className }: { className?: string }) {
  const { account, signOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    // thành công thì trang chuyển sang /login nên giữ trạng thái "đang đăng xuất"
    if (!(await signOut())) {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <section aria-label="Tài khoản" className={cx("rounded-xl bg-rail p-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(account.name)} bg="#233138" fg="#FFB65C" size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
          <p className="truncate text-xs text-ink-2">
            {account.role === "business" ? "Doanh nghiệp" : "Freelancer"} · {account.email}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Dữ liệu demo chỉ lưu trên trình duyệt này.</p>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/6 text-sm font-medium text-ink hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/40 disabled:cursor-progress disabled:opacity-70"
      >
        <LogOut size={16} aria-hidden /> {busy ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Chưa đăng xuất được. Kiểm tra kết nối rồi thử lại.
        </p>
      )}
    </section>
  );
}
