import { CloudOff, Stamp, TriangleAlert } from "lucide-react";
import { cx } from "../ui";

export type EmblemTone = "sealed" | "sealing" | "warning" | "offline";

const TONE = {
  sealed: { icon: Stamp, ring: "text-success" },
  sealing: { icon: Stamp, ring: "text-yellow" },
  warning: { icon: TriangleAlert, ring: "text-danger" },
  offline: { icon: CloudOff, ring: "text-amber" },
} as const;

/**
 * Con dấu niêm phong, vẽ như dấu mộc tròn có viền răng cưa nhẹ. Lúc đang niêm phong, con dấu "đóng" xuống một lần
 * mỗi nhịp; người dùng chọn giảm chuyển động thì đứng yên.
 */
export function SealEmblem({ tone, size = 56 }: { tone: EmblemTone; size?: number }) {
  const { icon: Icon, ring } = TONE[tone];
  return (
    <span className={cx("relative grid shrink-0 place-items-center", ring)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full">
        <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="1.5 2.6" opacity="0.6" />
        <circle cx="28" cy="28" r="21.5" fill="currentColor" opacity="0.12" />
        <circle cx="28" cy="28" r="21.5" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.45" />
      </svg>
      <Icon size={Math.round(size * 0.38)} strokeWidth={1.75} className={cx("relative", tone === "sealing" && "seal-press")} />
    </span>
  );
}
