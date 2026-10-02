"use client";

import { Copy, FileArchive, FileText, Image as ImageIcon, PenTool, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { fileSize, shortHash } from "@/lib/format";
import type { Attachment } from "@/lib/types";
import { cx } from "./ui";

export function fileIcon(name: string, size = 20): ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "fig") return <PenTool size={size} />;
  if (ext === "apk" || ext === "ipa") return <Smartphone size={size} />;
  if (["zip", "rar", "7z"].includes(ext)) return <FileArchive size={size} />;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return <ImageIcon size={size} />;
  return <FileText size={size} />;
}

/** Preview gọn trong chat: icon, tên, dung lượng, version — không hiện hash */
export function FilePreview({ a, out }: { a: Attachment; out?: boolean }) {
  return (
    <div className={cx("my-0.5 flex items-center gap-3 rounded-md px-2.5 py-2", out ? "bg-black/20" : "bg-black/25")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white/8 text-ink-2">{fileIcon(a.name)}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">{a.name}</span>
        <span className="block text-xs text-ink-2">
          {fileSize(a.size)}
          {a.version ? ` · v${a.version}` : ""}
        </span>
      </span>
    </div>
  );
}

/** Thẻ file đầy đủ cho panel Replyn Protection: có SHA-256 */
export function FileCard({ a }: { a: Attachment }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/6 text-ink-2">{fileIcon(a.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium">{a.name}</span>
          {a.version && <span className="shrink-0 rounded bg-white/8 px-1.5 text-[11px] font-semibold text-ink-2">v{a.version}</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          {fileSize(a.size)}
          <span>·</span>
          <button
            type="button"
            title={`SHA-256: ${a.hash} (bấm để sao chép)`}
            onClick={() => navigator.clipboard?.writeText(a.hash)}
            className="inline-flex items-center gap-1 font-mono text-ink-2 hover:text-ink"
          >
            sha256 {shortHash(a.hash)}
            <Copy size={11} />
          </button>
        </p>
      </div>
    </div>
  );
}
