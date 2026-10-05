import { CircleAlert, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "./marks";

/**
 * Trạng thái UI của đăng nhập QR — tách riêng khỏi trạng thái form Nova ID. Nova backend chỉ báo
 * chờ / đã xác nhận / hết hạn / đã dùng, nên không có bước "đã quét" riêng.
 */
export type QrPhase = "idle" | "loading" | "ready" | "approved" | "expired" | "used" | "error";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Dòng trạng thái dưới mã QR, đọc cho screen reader qua aria-live. */
export function QrStatus({ phase, secondsLeft }: { phase: QrPhase; secondsLeft: number }) {
  const line: Record<QrPhase, { icon: ReactNode; text: string; tone: string }> = {
    idle: { icon: <Spinner size={15} />, text: "Đang chuẩn bị mã…", tone: "text-(--na-muted)" },
    loading: { icon: <Spinner size={15} />, text: "Đang tạo mã…", tone: "text-(--na-muted)" },
    ready: { icon: <Clock size={15} aria-hidden />, text: `Mã hết hạn sau ${mmss(secondsLeft)}`, tone: "text-(--na-ink-2)" },
    approved: { icon: null, text: "Nova Mobile đã xác nhận. Đang đăng nhập…", tone: "text-(--na-success)" },
    expired: { icon: <CircleAlert size={15} aria-hidden />, text: "Mã đã hết hạn. Tạo mã mới để tiếp tục.", tone: "text-(--na-danger)" },
    used: { icon: <CircleAlert size={15} aria-hidden />, text: "Mã đã được dùng. Tạo mã mới để tiếp tục.", tone: "text-(--na-danger)" },
    error: { icon: <CircleAlert size={15} aria-hidden />, text: "Không kết nối được Nova. Kiểm tra kết nối rồi thử lại.", tone: "text-(--na-danger)" },
  };
  const l = line[phase];
  return (
    <p className={`flex min-h-5 items-center justify-center gap-1.5 text-center text-[13px] font-medium ${l.tone}`} aria-live="polite">
      {l.icon}
      {/* đếm ngược đổi mỗi giây: chỉ đọc khi đổi trạng thái, không đọc từng giây */}
      <span aria-hidden={phase === "ready"}>{l.text}</span>
      {phase === "ready" && <span className="sr-only">Mã sẵn sàng để quét bằng Nova Mobile.</span>}
    </p>
  );
}
