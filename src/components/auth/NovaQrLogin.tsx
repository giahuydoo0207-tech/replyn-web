"use client";

import qrcode from "qrcode-generator";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TalentIdentity } from "@/lib/auth/novaBusinessClient";
import { pollNovaQr, QR_MAX_POLL_FAILURES, QR_POLL_INTERVAL_MS, startNovaQr } from "@/lib/auth/novaQrClient";
import { cx } from "../ui";
import { focusRing, GuideSteps, linkClass, NovaMark, Spinner, SuccessCheck } from "./marks";
import { QrStatus, type QrPhase } from "./QrStatus";
import { readRememberDevice, RememberDevice } from "./RememberDevice";

const STEPS = ["Mở Nova trên điện thoại.", "Ở Trang chủ, nhấn biểu tượng quét QR cạnh chuông.", "Quét mã và xác nhận đăng nhập Replyn."];

interface QrSession {
  url: string;
  /** mili giây Unix */
  expiresAt: number;
}

/**
 * Mã QR: giải thích bên trái, thao tác bên phải (mobile: hướng dẫn trước, QR sau).
 * Panel luôn được render để khung không đổi kích thước, nhưng chỉ tạo mã khi tab QR được mở lần đầu.
 * Server Replyn tạo challenge trên Nova backend; trang hỏi lại mỗi 2 giây đến khi Nova Mobile xác nhận,
 * mã hết hạn, rời trang hoặc lỗi lặp lại.
 */
export function NovaQrLogin({
  active,
  onSuccess,
  onUseNovaId,
}: {
  active: boolean;
  onSuccess: (identity: TalentIdentity) => void;
  onUseNovaId: () => void;
}) {
  const [started, setStarted] = useState(active);
  const [phase, setPhase] = useState<QrPhase>(active ? "loading" : "idle");
  const [session, setSession] = useState<QrSession | null>(null);
  const [identity, setIdentity] = useState<TalentIdentity | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);

  // lần đầu mở tab QR: bắt đầu tạo mã (điều chỉnh state theo prop ngay khi render)
  if (active && !started) {
    setStarted(true);
    setPhase("loading");
  }

  /** Mỗi lần `attempt` đổi thì tạo mã mới; kết quả của lần gọi cũ bị bỏ qua. */
  useEffect(() => {
    if (!started) return;
    let alive = true;
    startNovaQr().then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setPhase("error");
        return;
      }
      setSession({ url: r.qrUrl, expiresAt: r.expiresAt });
      setNow(Date.now());
      setPhase("ready");
    });
    return () => {
      alive = false;
    };
  }, [attempt, started]);

  const regenerate = () => {
    setPhase("loading");
    setAttempt((n) => n + 1);
  };

  // đồng hồ hết hạn: chỉ chạy khi mã còn hiệu lực
  useEffect(() => {
    if (phase !== "ready" || !session) return;
    const t = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= session.expiresAt) setPhase((p) => (p === "ready" ? "expired" : p));
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, session]);

  // hỏi server mỗi 2 giây, không chồng yêu cầu; dừng khi hết "ready" hoặc rời trang
  useEffect(() => {
    if (phase !== "ready" || !session) return;
    let alive = true;
    let failures = 0;
    let timer = 0;
    const tick = async () => {
      const r = await pollNovaQr(readRememberDevice());
      if (!alive) return;
      if (r.kind === "approved") {
        setIdentity(r.identity);
        setPhase("approved");
        return;
      }
      if (r.kind === "expired" || r.kind === "used") {
        setPhase(r.kind);
        return;
      }
      if (r.kind === "error") {
        failures += 1;
        if (!r.retryable || failures >= QR_MAX_POLL_FAILURES) {
          setPhase("error");
          return;
        }
      } else {
        failures = 0;
      }
      timer = window.setTimeout(tick, QR_POLL_INTERVAL_MS);
    };
    timer = window.setTimeout(tick, QR_POLL_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [phase, session]);

  useEffect(() => {
    if (phase !== "approved" || !identity) return;
    const t = window.setTimeout(() => onSuccess(identity), 650);
    return () => window.clearTimeout(t);
  }, [phase, identity, onSuccess]);

  const secondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;
  const busy = phase === "loading" || phase === "idle" || phase === "approved";

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-0">
      <section aria-label="Hướng dẫn quét mã" className="md:border-r md:border-(--na-border) md:pr-10">
        <GuideSteps title="Quét bằng Nova Mobile" steps={STEPS} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <RememberDevice />
          <button type="button" onClick={onUseNovaId} className={linkClass}>
            Dùng Nova ID thay thế
          </button>
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 border-t border-(--na-border) pt-6 md:border-t-0 md:pl-10 md:pt-0">
        <QrFrame phase={phase} url={session?.url} onRegenerate={regenerate} />
        <div className="flex items-center gap-1.5">
          <QrStatus phase={phase} secondsLeft={secondsLeft} />
          <span className="group relative">
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              aria-label="Làm mới mã QR"
              className={cx("grid size-8 place-items-center rounded-md text-(--na-muted) hover:bg-(--na-raised) hover:text-(--na-ink) disabled:opacity-40", focusRing)}
            >
              <RefreshCw size={16} aria-hidden />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-(--na-raised) px-2 py-1 text-[12px] text-(--na-ink) opacity-0 shadow-lg ring-1 ring-(--na-border) transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
            >
              Làm mới mã QR
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Cạnh khung QR (đã gồm vùng yên tĩnh 4 module màu trắng). */
const QR_SIZE = 240;

function QrFrame({ phase, url, onRegenerate }: { phase: QrPhase; url?: string; onRegenerate: () => void }) {
  const matrix = useMemo(() => (url ? qrPath(url) : null), [url]);
  const showCode = !!matrix && phase !== "loading" && phase !== "idle" && phase !== "error";
  const dead = phase === "expired" || phase === "used" || phase === "error";
  return (
    <div className="relative shrink-0 overflow-hidden rounded-lg bg-white" style={{ width: QR_SIZE, height: QR_SIZE }}>
      {showCode && (
        <svg
          role="img"
          aria-label="Mã QR đăng nhập Replyn qua Nova. Quét bằng ứng dụng Nova trên điện thoại."
          viewBox={`-4 -4 ${matrix.size + 8} ${matrix.size + 8}`}
          width={QR_SIZE}
          height={QR_SIZE}
          shapeRendering="crispEdges"
          className={cx("transition-[filter] duration-200", dead && "blur-[2px]")}
        >
          <path d={matrix.path} fill="var(--na-qr-ink)" />
        </svg>
      )}
      {showCode && phase === "ready" && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-[3px]" aria-hidden>
          <NovaMark size={34} />
        </span>
      )}
      {phase === "ready" && <span className="na-scan-line" style={{ ["--na-scan-distance" as string]: `${QR_SIZE - 2}px` }} aria-hidden />}

      {phase !== "ready" && (
        // lớp phủ tối: chữ trạng thái luôn đọc được, mã cũ chỉ còn mờ phía sau
        <div className="na-fade absolute inset-0 grid place-items-center bg-(--na-subtle)/92 p-6 text-center">
          {(phase === "loading" || phase === "idle") && (
            <span className="flex flex-col items-center gap-2 text-[13px] text-(--na-ink-2)">
              <Spinner size={22} /> Đang tạo mã
            </span>
          )}
          {phase === "approved" && (
            <span className="flex flex-col items-center gap-2 text-[14px] font-semibold text-(--na-ink)">
              <SuccessCheck />
              Đã xác nhận
            </span>
          )}
          {dead && (
            <span className="flex flex-col items-center gap-3">
              <span className="text-[14px] font-medium text-(--na-ink)">
                {phase === "expired" ? "Mã đã hết hạn" : phase === "used" ? "Mã đã được dùng" : "Không thể tạo mã"}
              </span>
              <button
                type="button"
                onClick={onRegenerate}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--na-accent) px-3 text-[14px] font-semibold text-(--na-on-accent) hover:bg-(--na-accent-hover)",
                  focusRing,
                )}
              >
                <RefreshCw size={15} aria-hidden /> {phase === "error" ? "Thử lại" : "Tạo mã mới"}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Ma trận QR thành một path SVG; chừa trống vùng giữa cho logo (mức sửa lỗi H chịu được ~30%). */
function qrPath(text: string): { size: number; path: string } {
  const qr = qrcode(0, "H");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const hole = Math.ceil(n * 0.2);
  const start = Math.floor((n - hole) / 2);
  let path = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inLogo = r >= start && r < start + hole && c >= start && c < start + hole;
      if (!inLogo && qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { size: n, path };
}
