"use client";

import { FolderOpen } from "lucide-react";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { FileCard } from "../chat/Messages";

export function FilesTab({ ws }: { ws: Workspace }) {
  const { state } = useStore();
  if (!ws.attachments.length) {
    return (
      <div className="px-4 py-12 text-center">
        <FolderOpen size={32} className="mx-auto text-muted" />
        <p className="mt-2 font-semibold">Chưa có file</p>
        <p className="mt-1 text-sm text-ink-2">Kéo thả file vào khung chat để gửi hoặc nộp sản phẩm cho milestone.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {[...ws.attachments].reverse().map((a) => {
        const idx = a.milestoneId ? ws.milestones.findIndex((m) => m.id === a.milestoneId) + 1 : 0;
        return (
          <li key={a.id} className="rounded-xl bg-panel px-3 py-1 ring-1 ring-line">
            <FileCard a={a} compact />
            <p className="pb-1.5 text-[12px] text-muted">
              {state.users[a.uploadedBy]?.name} · {ddmmyyyy(a.at)} {hhmm(a.at)}
              {idx > 0 && ` · Milestone ${idx}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
