"use client";

import { FolderOpen } from "lucide-react";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { jumpToEvidence, useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { FileCard } from "../FileCard";

export function FilesTab({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  if (!ws.attachments.length) {
    return (
      <div className="px-4 py-12 text-center">
        <FolderOpen size={30} className="mx-auto text-muted" />
        <p className="mt-2 font-medium">Chưa có file</p>
        <p className="mt-1 text-sm text-ink-2">Kéo thả file vào khung chat để gửi hoặc nộp sản phẩm cho milestone.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {[...ws.attachments].reverse().map((a) => {
        const idx = a.milestoneId ? ws.milestones.findIndex((m) => m.id === a.milestoneId) + 1 : 0;
        const ev = ws.evidence.find((e) => e.attachmentId === a.id);
        return (
          <li key={a.id} className="rounded-xl bg-panel px-3.5 py-2">
            <FileCard a={a} />
            <p className="mt-0.5 break-all font-mono text-[11px] leading-snug text-muted" title="SHA-256">
              {a.hash}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
              <span className="text-ink-2">
                {state.users[a.uploadedBy]?.short} · {ddmmyyyy(a.at)} {hhmm(a.at)}
                {idx > 0 && ` · Giai đoạn ${idx}`}
              </span>
              {ev && (
                <button
                  type="button"
                  onClick={() => jumpToEvidence(dispatch, ev.id)}
                  className="shrink-0 text-ink underline decoration-white/25 underline-offset-2 hover:decoration-white/70"
                >
                  Xem bằng chứng liên quan
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
