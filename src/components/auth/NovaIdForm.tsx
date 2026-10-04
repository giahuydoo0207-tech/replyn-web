"use client";

import { CircleAlert, CircleHelp, Eye, EyeOff, IdCard, KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  loginWithNovaBusiness,
  normalizeBusinessNovaId,
  NOVA_BUSINESS_ID_PATTERN,
  NOVA_KEY_PATTERN,
  type BusinessIdentity,
  type BusinessLoginResult,
} from "@/lib/auth/novaBusinessClient";
import { cx } from "../ui";
import { focusRing, GuideSteps, linkClass, Spinner } from "./marks";
import { readRememberDevice, RememberDevice } from "./RememberDevice";

type FormStatus = "idle" | "loading" | "error";
type FieldErrors = { id?: string; key?: string };
type FailureReason = Extract<BusinessLoginResult, { ok: false }>["reason"];

const inputBox =
  "flex h-11 items-center gap-2.5 rounded-lg border bg-(--na-bg) px-3 transition-colors focus-within:border-(--na-accent) focus-within:ring-2 focus-within:ring-(--na-accent)/25";

const GUIDE = ["Mở Nova Business → Thông tin cá nhân.", "Sao chép Nova ID.", "Dùng Nova Key đã lưu khi tạo khóa."];

const FAILURE_MESSAGE: Record<FailureReason, string> = {
  invalid_credentials:
    "Nova ID hoặc Nova Key không đúng, hoặc Nova Key đã bị thu hồi. Tạo Nova Key mới trong Nova Business rồi thử lại.",
  invalid_input: "Nova ID hoặc Nova Key không đúng định dạng.",
  unavailable: "Chưa kết nối được Nova Business. Vui lòng thử lại sau ít phút.",
  not_configured: "Đăng nhập bằng Nova ID tạm thời chưa khả dụng trên Replyn.",
};

/**
 * Nova ID: thao tác bên trái, giải thích bên phải (mobile: form trước, hướng dẫn rút gọn sau).
 * Nova ID là định danh công khai nên luôn đi cùng Nova Key bí mật. Server Replyn xác minh cặp này với
 * Nova Business; Nova Key chỉ nằm trong state của form lúc nhập và bị xóa sau mỗi lần gửi.
 */
export function NovaIdForm({ onSuccess }: { onSuccess: (identity: BusinessIdentity) => void }) {
  const ids = useId();
  const [novaId, setNovaId] = useState("");
  const [novaKey, setNovaKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [failure, setFailure] = useState<FailureReason>("invalid_credentials");
  const [errors, setErrors] = useState<FieldErrors>({});
  const idRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  // chặn gửi lặp ngay cả trước khi state "loading" kịp render
  const submitting = useRef(false);
  const loading = status === "loading";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const id = normalizeBusinessNovaId(novaId);
    setNovaId(id);
    const next: FieldErrors = {};
    if (!id) next.id = "Nhập Nova ID của bạn.";
    else if (!NOVA_BUSINESS_ID_PATTERN.test(id)) next.id = "Nova ID có dạng NVB-XXXXXXXX (8 ký tự chữ hoặc số).";
    if (!novaKey) next.key = "Nhập Nova Key.";
    else if (!NOVA_KEY_PATTERN.test(novaKey)) next.key = "Nova Key bắt đầu bằng nvk_ và có 47 ký tự.";
    setErrors(next);
    if (next.id || next.key) {
      setStatus("idle");
      (next.id ? idRef : keyRef).current?.focus();
      return;
    }
    submitting.current = true;
    setStatus("loading");
    const result = await loginWithNovaBusiness(id, novaKey, readRememberDevice());
    // Nova Key không được giữ lại sau khi gửi, dù thành công hay thất bại
    setNovaKey("");
    if (result.ok) {
      // form giữ trạng thái khóa trong lúc chuyển sang Replyn
      onSuccess(result.identity);
      return;
    }
    submitting.current = false;
    setFailure(result.reason);
    setStatus("error");
    keyRef.current?.focus();
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-0">
      <form onSubmit={submit} noValidate className="space-y-4 md:pr-10" aria-busy={loading}>
        {status === "error" && (
          <p role="alert" className="na-fade flex items-start gap-2 rounded-lg bg-(--na-danger)/12 px-3 py-2.5 text-[14px] text-(--na-danger)">
            <CircleAlert size={17} className="mt-px shrink-0" aria-hidden />
            {FAILURE_MESSAGE[failure]}
          </p>
        )}

        <div>
          <label htmlFor={`${ids}-id`} className="text-[14px] font-semibold text-(--na-ink)">
            Nova ID
          </label>
          <div className={cx(inputBox, "mt-1.5", errors.id ? "border-(--na-danger)" : "border-(--na-border)")}>
            <IdCard size={18} className="shrink-0 text-(--na-muted)" aria-hidden />
            <input
              ref={idRef}
              id={`${ids}-id`}
              name="novaId"
              value={novaId}
              onChange={(e) => {
                setNovaId(e.target.value.replace(/\s+/g, "").toUpperCase());
                if (errors.id) setErrors((x) => ({ ...x, id: undefined }));
              }}
              onBlur={() => setNovaId((v) => normalizeBusinessNovaId(v))}
              placeholder="NVB-XXXXXXXX"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={loading}
              aria-invalid={!!errors.id}
              aria-describedby={errors.id ? `${ids}-id-err` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-[15px] tracking-wide text-(--na-ink) outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-(--na-muted)"
            />
          </div>
          {errors.id && <p id={`${ids}-id-err`} className="mt-1.5 text-[13px] text-(--na-danger)">{errors.id}</p>}
        </div>

        <div>
          <label htmlFor={`${ids}-key`} className="text-[14px] font-semibold text-(--na-ink)">
            Nova Key
          </label>
          <div className={cx(inputBox, "mt-1.5", errors.key ? "border-(--na-danger)" : "border-(--na-border)")}>
            <KeyRound size={18} className="shrink-0 text-(--na-muted)" aria-hidden />
            <input
              ref={keyRef}
              id={`${ids}-key`}
              name="novaKey"
              type={showKey ? "text" : "password"}
              value={novaKey}
              onChange={(e) => {
                setNovaKey(e.target.value);
                if (errors.key) setErrors((x) => ({ ...x, key: undefined }));
              }}
              placeholder="nvk_…"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              aria-invalid={!!errors.key}
              aria-describedby={errors.key ? `${ids}-key-err` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-(--na-ink) outline-none placeholder:text-(--na-muted)"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Ẩn Nova Key" : "Hiện Nova Key"}
              aria-pressed={showKey}
              title={showKey ? "Ẩn Nova Key" : "Hiện Nova Key"}
              className={cx("-mr-1.5 grid size-8 place-items-center rounded-md text-(--na-muted) hover:bg-(--na-raised) hover:text-(--na-ink)", focusRing)}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.key && <p id={`${ids}-key-err`} className="mt-1.5 text-[13px] text-(--na-danger)">{errors.key}</p>}
        </div>

        <RememberDevice />

        <button
          type="submit"
          disabled={loading}
          className={cx(
            "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--na-accent) text-[15px] font-semibold text-(--na-on-accent) transition-colors hover:bg-(--na-accent-hover) disabled:cursor-progress disabled:opacity-80",
            focusRing,
          )}
        >
          {loading ? (
            <>
              <Spinner /> Đang xác thực…
            </>
          ) : (
            "Tiếp tục với Nova ID"
          )}
        </button>
      </form>

      <aside aria-label="Hướng dẫn Nova ID" className="border-t border-(--na-border) pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
        <GuideSteps title="Đăng nhập dành cho Nova Business" steps={GUIDE} />
        <p className="mt-5 text-[14px] text-(--na-ink-2)">Nova ID dùng để nhận diện tài khoản. Nova Key dùng để xác minh đăng nhập.</p>
        <div className="mt-4">
          <HelpPopover />
        </div>
      </aside>
    </div>
  );
}

function HelpPopover() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="relative w-fit">
      <button ref={trigger} type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className={cx(linkClass, "inline-flex items-center gap-1.5")}>
        <CircleHelp size={15} aria-hidden /> Nova ID của tôi ở đâu?
      </button>
      {open && (
        <div
          ref={box}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="na-fade absolute left-0 top-8 z-20 w-[min(300px,calc(100vw-64px))] rounded-lg border border-(--na-border) bg-(--na-raised) p-3.5 text-[13px] text-(--na-ink-2) shadow-[0_8px_24px_rgb(0_0_0/0.45)] outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <p id={titleId} className="font-semibold text-(--na-ink)">Tìm Nova ID</p>
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
              className={cx("-mr-1 -mt-1 grid size-7 place-items-center rounded-md text-(--na-muted) hover:bg-(--na-subtle) hover:text-(--na-ink)", focusRing)}
            >
              <X size={15} />
            </button>
          </div>
          <p className="mt-1">Nova Business → Thông tin cá nhân → Định danh Nova</p>
          <p className="mt-1.5 text-(--na-muted)">Nova Key chỉ hiển thị một lần khi tạo. Nếu làm mất, hãy tạo khóa mới ở mục Khóa kết nối Nova.</p>
        </div>
      )}
    </div>
  );
}
