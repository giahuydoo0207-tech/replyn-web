/**
 * Đề xuất đổi phạm vi: một bên đề xuất sửa giá, hạn hoặc tên giai đoạn, thêm hoặc bớt giai đoạn; bên kia đồng ý thì
 * thỏa thuận lên phiên bản mới. Hàm thuần, dùng chung cho reducer và giao diện.
 */
import type { ChangeOp, Milestone, MilestoneStatus, MilestoneTerms, ScopeChange, Workspace } from "./types";

/** Giai đoạn còn đổi được: chưa giải ngân, chưa có quyết định, không đang tranh chấp hay chờ giải ngân. */
const EDITABLE: MilestoneStatus[] = ["awaiting_funding", "funded_sim", "submitted", "in_review", "revision_requested"];

export const canEditMilestone = (m: Milestone) => EDITABLE.includes(m.status);
/** Chỉ bỏ được giai đoạn chưa ký quỹ, để không phải xử lý hoàn tiền. */
export const canRemoveMilestone = (m: Milestone) => m.status === "awaiting_funding";

export const termsOf = (m: Pick<Milestone, "title" | "amount" | "deadline">): MilestoneTerms => ({
  title: m.title,
  amount: m.amount,
  deadline: m.deadline,
});

export const sameTerms = (a: MilestoneTerms, b: MilestoneTerms) =>
  a.title.trim() === b.title.trim() && a.amount === b.amount && a.deadline === b.deadline;

export const currentVersion = (ws: Workspace) => ws.version ?? 1;
export const pendingChange = (ws: Workspace): ScopeChange | undefined => ws.changes?.find((c) => c.status === "pending");

export const validTerms = (t: MilestoneTerms) =>
  t.title.trim().length > 0 && Number.isFinite(t.amount) && t.amount > 0 && /^\d{2}\/\d{2}\/\d{4}$/.test(t.deadline);

/** Tổng trước và sau khi áp dụng đề xuất. `before` có thể truyền sẵn (tổng lúc đề xuất). */
export function totals(milestones: Pick<Milestone, "id" | "amount">[], ops: ChangeOp[], beforeTotal?: number) {
  const before = beforeTotal ?? milestones.reduce((sum, m) => sum + m.amount, 0);
  let after = before;
  for (const o of ops) {
    if (o.op === "edit") after += o.after.amount - o.before.amount;
    else if (o.op === "add") after += o.after.amount;
    else after -= o.before.amount;
  }
  return { before, after, delta: after - before };
}

/**
 * Áp dụng đề xuất lên danh sách giai đoạn. Trả null nếu đề xuất không còn hợp lệ (ví dụ giai đoạn đã giải ngân
 * trong lúc chờ), để không áp dụng nửa vời.
 */
export function applyOps(milestones: Milestone[], ops: ChangeOp[], newId: (i: number) => string): Milestone[] | null {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  for (const o of ops) {
    if (o.op === "add") {
      if (!validTerms(o.after)) return null;
      continue;
    }
    const m = byId.get(o.milestoneId);
    if (!m) return null;
    if (o.op === "edit" && (!canEditMilestone(m) || !validTerms(o.after))) return null;
    if (o.op === "remove" && !canRemoveMilestone(m)) return null;
  }
  const removed = new Set(ops.flatMap((o) => (o.op === "remove" ? [o.milestoneId] : [])));
  const edits = new Map(ops.flatMap((o) => (o.op === "edit" ? [[o.milestoneId, o.after] as const] : [])));
  const kept = milestones
    .filter((m) => !removed.has(m.id))
    .map((m) => {
      const e = edits.get(m.id);
      return e ? { ...m, title: e.title.trim(), amount: e.amount, deadline: e.deadline } : m;
    });
  const template = milestones[milestones.length - 1];
  const added = ops
    .filter((o): o is Extract<ChangeOp, { op: "add" }> => o.op === "add")
    .map(
      (o, i): Milestone => ({
        id: newId(i),
        title: o.after.title.trim(),
        amount: o.after.amount,
        deadline: o.after.deadline,
        status: "awaiting_funding",
        reviewDays: template?.reviewDays ?? 3,
        revisionLimit: template?.revisionLimit ?? 2,
        revisionsUsed: 0,
        criteria: [],
        submissionIds: [],
      }),
    );
  return [...kept, ...added];
}

/** "2026-10-25" <-> "25/10/2026" cho ô chọn ngày. */
export const toInputDate = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
export const fromInputDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
