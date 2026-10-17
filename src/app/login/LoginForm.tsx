"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useState } from "react";
import { ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/accounts";
import { Avatar, Button, ReplynMark } from "@/components/ui";
import { initials } from "@/lib/reducer";

const ERRORS: Record<string, string> = {
  invalid_credentials: "Email hoặc mật khẩu chưa đúng.",
  not_configured: "Máy chủ chưa cấu hình REPLYN_SESSION_SECRET nên chưa đăng nhập được.",
};

/** Đăng nhập bằng tài khoản mẫu. Bấm một tài khoản để điền sẵn email và mật khẩu. */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.replace("/");
      return;
    }
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setError(ERRORS[body?.error ?? ""] ?? "Chưa đăng nhập được. Thử lại sau.");
    setBusy(false);
  };

  const field =
    "mt-1.5 h-11 w-full rounded-xl bg-rail px-3.5 text-[15px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white/40";

  return (
    <main className="grid min-h-dvh place-items-center overflow-y-auto bg-app px-4 py-10 text-ink">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3">
          <ReplynMark size={40} />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Replyn</h1>
            <p className="text-sm text-ink-2">Chat, thỏa thuận dự án và bằng chứng ở cùng một nơi.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-8 rounded-2xl bg-panel p-5 ring-1 ring-line">
          <h2 className="text-lg font-semibold">Đăng nhập</h2>
          <label className="mt-4 block text-sm font-medium text-ink-2">
            Email
            <input className={field} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="mt-3 block text-sm font-medium text-ink-2">
            Mật khẩu
            <input className={field} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="mt-5 h-11 w-full" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="animate-spin" /> : <LogIn size={17} />} Đăng nhập
          </Button>
        </form>

        <section className="mt-5" aria-label="Tài khoản mẫu">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Tài khoản mẫu · mật khẩu {DEMO_PASSWORD}</p>
          <ul className="mt-2 space-y-1.5">
            {ACCOUNTS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(DEMO_PASSWORD);
                    setError(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-line hover:bg-white/6"
                >
                  <Avatar initials={initials(a.name)} bg="#233138" fg="#e9edef" size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted">{a.email}</span>
                  </span>
                  <span className="shrink-0 rounded bg-white/6 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                    {a.role === "business" ? "Business" : "Freelancer"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
            Bản demo chưa có máy chủ dữ liệu: chat và dự án lưu trong trình duyệt, tải lại trang sẽ về dữ liệu mẫu.
          </p>
        </section>
      </div>
    </main>
  );
}
