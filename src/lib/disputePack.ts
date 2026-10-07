/**
 * Gói hồ sơ tranh chấp: gom mọi thứ của một workspace để đội ngũ hỗ trợ đối chiếu. Hai bên đều xem được hồ sơ gồm
 * những gì; không ai sửa được vì hồ sơ được dựng lại từ dữ liệu dự án mỗi lần tải. Hàm thuần.
 *
 * Tin đã thu hồi trong workspace vẫn có trong hồ sơ (đúng như Lưu trữ dự án), vì đây là bối cảnh hợp đồng.
 */
import { findAttachment, NOVA_TEAM_ID, STATUS_LABEL, SYSTEM_ID, type AppState } from "./reducer";
import { currentVersion } from "./scopeChange";
import type { ChangeOp, Message, ScopeChangeStatus } from "./types";

export const DISPUTE_PACK_FORMAT = "replyn-dispute-pack/1";

export interface PackMessage {
  at: string;
  chapter: "before" | "during";
  sender: string;
  text: string | null;
  file: { name: string; size: number; sha256: string } | null;
  pinned: boolean;
  recalledAt: string | null;
}

export interface DisputePack {
  format: typeof DISPUTE_PACK_FORMAT;
  generatedAt: string;
  workspace: { id: string; title: string; client: string; contractor: string; agreementNo: string | null };
  agreement: {
    version: number;
    original: {
      scope: string;
      deliverables: string[];
      notes: string;
      totalAmount: number;
      currency: string;
      startDate: string | null;
      deadline: string | null;
      acceptedAt: string;
    } | null;
    changes: {
      fromVersion: number;
      status: ScopeChangeStatus;
      proposedBy: string;
      at: string;
      reason: string;
      ops: ChangeOp[];
      respondedBy: string | null;
      respondedAt: string | null;
      responseNote: string | null;
    }[];
  };
  milestones: { index: number; title: string; amount: number; deadline: string; status: string }[];
  submissions: { milestone: string; version: number; at: string; note: string; file: { name: string; size: number; sha256: string } | null }[];
  disputes: { milestone: string; openedBy: string; at: string; reason: string; status: string }[];
  events: { at: string; title: string; description: string }[];
  messages: PackMessage[];
}

const iso = (ms: number) => new Date(ms).toISOString();

export function buildDisputePack(state: AppState, wsId: string, now = Date.now()): DisputePack | null {
  const ws = state.workspaces[wsId];
  if (!ws) return null;
  const name = (id: string | undefined) => (id ? state.users[id]?.name ?? id : "");
  const msTitle = (id: string) => {
    const i = ws.milestones.findIndex((m) => m.id === id);
    return i >= 0 ? `Giai đoạn ${i + 1} · ${ws.milestones[i].title}` : "Giai đoạn đã bỏ";
  };
  const fileOf = (attachmentId: string | undefined) => {
    const a = findAttachment(state, attachmentId);
    return a ? { name: a.name, size: a.size, sha256: a.hash } : null;
  };

  // Lưu trữ tin nhắn: trao đổi trước khi chốt (nếu có) rồi hội thoại trong workspace; bỏ thông báo hệ thống.
  const chat = Object.values(state.conversations).find((c) => c.workspaceId === ws.id);
  const userMsgs = (list: Message[] | undefined) =>
    (list ?? []).filter((m) => ["text", "file", "submission", "change"].includes(m.kind) && m.senderId !== SYSTEM_ID && m.senderId !== NOVA_TEAM_ID);
  const toPack = (chapter: PackMessage["chapter"]) => (m: Message): PackMessage => ({
    at: iso(m.at),
    chapter,
    sender: name(m.senderId),
    text: m.kind === "change" ? `[Đề xuất thay đổi thỏa thuận] ${m.text ?? ""}` : m.text ?? null,
    file: m.kind === "text" ? null : fileOf(m.refs?.attachmentId),
    pinned: !!m.pinnedAt && !m.recalledAt,
    recalledAt: m.recalledAt ? iso(m.recalledAt) : null,
  });
  const before = userMsgs(chat?.sourceNovaChatId ? state.messages[chat.sourceNovaChatId] : undefined).map(toPack("before"));
  const during = userMsgs(chat ? state.messages[chat.id] : undefined).map(toPack("during"));

  const a = ws.agreement;
  return {
    format: DISPUTE_PACK_FORMAT,
    generatedAt: iso(now),
    workspace: {
      id: a?.novaWorkspaceId ?? ws.id,
      title: ws.title,
      client: name(ws.businessId),
      contractor: name(ws.freelancerId),
      agreementNo: a ? `RPL-${a.novaWorkspaceId.slice(0, 8).toUpperCase()}` : null,
    },
    agreement: {
      version: currentVersion(ws),
      original: a
        ? {
            scope: a.scope,
            deliverables: a.deliverables,
            notes: a.notes,
            totalAmount: a.totalAmount,
            currency: a.currency,
            startDate: a.startDate,
            deadline: a.deadline,
            acceptedAt: iso(a.acceptedAt),
          }
        : null,
      changes: (ws.changes ?? []).map((c) => ({
        fromVersion: c.fromVersion,
        status: c.status,
        proposedBy: name(c.proposedBy),
        at: iso(c.at),
        reason: c.reason,
        ops: c.ops,
        respondedBy: c.respondedBy ? name(c.respondedBy) : null,
        respondedAt: c.respondedAt ? iso(c.respondedAt) : null,
        responseNote: c.responseNote ?? null,
      })),
    },
    milestones: ws.milestones.map((m, i) => ({ index: i + 1, title: m.title, amount: m.amount, deadline: m.deadline, status: STATUS_LABEL[m.status] })),
    submissions: ws.submissions.map((s) => ({ milestone: msTitle(s.milestoneId), version: s.version, at: iso(s.at), note: s.note, file: fileOf(s.attachmentId) })),
    disputes: ws.disputes.map((d) => ({
      milestone: msTitle(d.milestoneId),
      openedBy: name(d.openedBy),
      at: iso(d.at),
      reason: d.reason,
      status: d.status === "open" ? "Đã tiếp nhận" : d.status === "reviewing" ? "Đang đối chiếu" : "Đã có phương án",
    })),
    events: ws.evidence.map((e) => ({ at: iso(e.at), title: e.title, description: e.description })),
    messages: [...before, ...during],
  };
}

/** Số lượng từng phần, để hai bên thấy hồ sơ gồm những gì trước khi gửi hay tải. */
export function packSummary(p: DisputePack) {
  return {
    versions: p.agreement.version,
    changes: p.agreement.changes.length,
    milestones: p.milestones.length,
    submissions: p.submissions.length,
    disputes: p.disputes.length,
    events: p.events.length,
    messages: p.messages.length,
    recalled: p.messages.filter((m) => m.recalledAt).length,
    pinned: p.messages.filter((m) => m.pinned).length,
  };
}
