import { findAttachment, type AppState } from "./reducer";
import type { Message } from "./types";

/** Một dòng tóm tắt tin nhắn cho chat list và reply quote */
export function previewOf(s: AppState, m: Message): string {
  const ws = m.refs?.workspaceId ? s.workspaces[m.refs.workspaceId] : undefined;
  const ms = ws?.milestones.find((x) => x.id === m.refs?.milestoneId);
  switch (m.kind) {
    case "text":
    case "system":
      return m.text ?? "";
    case "file":
      return `📎 ${findAttachment(s, m.refs?.attachmentId)?.name ?? "Tệp"}`;
    case "proposal":
      return "✦ Đề xuất chuyển sang Replyn";
    case "milestone":
      return `Milestone: ${ms?.title ?? ""}`;
    case "submission": {
      const a = findAttachment(s, m.refs?.attachmentId);
      return `📦 Đã nộp sản phẩm · ${a?.name ?? ""}`;
    }
    case "payment":
      return m.text === "released" ? "Đã giải ngân (mô phỏng)" : "Đã cấp vốn (mô phỏng)";
    case "dispute":
      return `⚠ Đã mở tranh chấp: ${m.text ?? ""}`;
    case "decision":
      return "⚖ Quyết định của Đội ngũ Nova";
  }
}
