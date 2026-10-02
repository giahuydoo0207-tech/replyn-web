import { findAttachment, type AppState } from "./reducer";
import type { Message } from "./types";

const DECISION_LABEL = { release: "Giải ngân", refund: "Hoàn tiền", split: "Chia tiền" } as const;

/** Một dòng notice cho các sự kiện nghiệp vụ trong chat (không còn card lớn) */
export function noticeText(s: AppState, m: Message): string {
  const ws = m.refs?.workspaceId ? s.workspaces[m.refs.workspaceId] : undefined;
  const ms = ws?.milestones.find((x) => x.id === m.refs?.milestoneId);
  const idx = ws && ms ? ws.milestones.indexOf(ms) + 1 : 0;
  const name = (id?: string) => (id ? s.users[id]?.short : "") ?? "";
  switch (m.kind) {
    case "payment":
      return m.text === "released"
        ? `Đã kích hoạt giải ngân mô phỏng cho Milestone ${idx}`
        : `${name(ws?.businessId)} đã kích hoạt ký quỹ mô phỏng cho Milestone ${idx}`;
    case "submission": {
      const a = findAttachment(s, m.refs?.attachmentId);
      return `${name(ws?.freelancerId)} đã nộp file cho Milestone ${idx}${a?.version ? ` (v${a.version})` : ""}`;
    }
    case "dispute":
      return `Tranh chấp đã được mở · Milestone ${idx}`;
    case "decision":
      return `Đội ngũ Nova đã giải quyết tranh chấp${ms?.payout ? ` · ${DECISION_LABEL[ms.payout.decision]}` : ""}`;
    default:
      return m.text ?? "";
  }
}

/** Một dòng tóm tắt tin nhắn cho chat list và reply quote */
export function previewOf(s: AppState, m: Message): string {
  switch (m.kind) {
    case "text":
      return m.text ?? "";
    case "file":
      return `📎 ${findAttachment(s, m.refs?.attachmentId)?.name ?? "Tệp"}`;
    case "proposal":
      return "Đề xuất chuyển sang Replyn";
    case "submission":
      return `📎 ${findAttachment(s, m.refs?.attachmentId)?.name ?? "Tệp"}`;
    default:
      return noticeText(s, m);
  }
}
