"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cx } from "../ui";

const short = (value: string, head = 8, tail = 6) => (value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value);

/**
 * Phần kỹ thuật của niêm phong, gập sẵn: người dùng thường không cần đọc, người muốn tự kiểm tra thì mở ra.
 */
export function TechDetails({
  signature,
  explorerUrl,
  fingerprint,
  onDownloadRaw,
}: {
  signature?: string;
  explorerUrl?: string;
  fingerprint: string;
  /** Tải dữ liệu gốc dạng JSON, cho dev hoặc bên Nova cần đối chiếu. */
  onDownloadRaw?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-white/8 pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left text-[13px] text-ink-2 hover:text-ink"
      >
        Chi tiết kỹ thuật
        <ChevronDown size={16} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <dl className="msg-in mt-3 space-y-2.5 text-[13px]">
          <Row label="Nơi lưu">Solana, mạng thử nghiệm (devnet)</Row>
          {signature && (
            <Row label="Giao dịch">
              <span className="font-mono text-[12px]">{short(signature)}</span>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-link hover:underline">
                  Mở trên Solana Explorer <ExternalLink size={12} />
                </a>
              )}
            </Row>
          )}
          <Row label="Dấu vân tay">
            <span className="font-mono text-[12px]" title={fingerprint}>{short(fingerprint)}</span>
            <CopyButton value={fingerprint} />
          </Row>
          {onDownloadRaw && (
            <Row label="File kỹ thuật">
              <button type="button" onClick={onDownloadRaw} className="inline-flex items-center gap-1 text-link hover:underline">
                <Download size={12} /> Tải dữ liệu gốc (JSON)
              </button>
            </Row>
          )}
          <p className="text-[12px] leading-relaxed text-muted">
            Dấu vân tay là mã SHA-256 tính từ toàn bộ điều khoản. Chỉ mã này được ghi lên chuỗi, nội dung thỏa thuận thì không.
          </p>
        </dl>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center text-ink">{children}</dd>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Đã chép" : "Chép dấu vân tay"}
      title={done ? "Đã chép" : "Chép"}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
      className="ml-2 grid size-6 place-items-center rounded text-ink-2 hover:bg-white/8 hover:text-ink"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}
