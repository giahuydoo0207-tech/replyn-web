import type { PanelTab } from "./reducer";
import type { Milestone, Workspace } from "./types";

const CLOSED = ["released_sim", "refunded", "split"];

export const isClosed = (m: Milestone) => CLOSED.includes(m.status);

/** Tranh chấp chưa có quyết định (OPEN hoặc MEDIATION) */
export const openDisputes = (ws: Workspace) => ws.disputes.filter((d) => d.status !== "resolved");

/** Milestone đang chờ chính người xem hành động */
export function milestonesNeedingMe(ws: Workspace, meId: string): Milestone[] {
  const biz = meId === ws.businessId;
  const fl = meId === ws.freelancerId;
  // chỉ milestone đang tới lượt mới cần ký quỹ, không giục ký quỹ M2 khi M1 còn chạy
  const current = ws.milestones.find((m) => !isClosed(m));
  return ws.milestones.filter((m) => {
    if (biz)
      return (
        (m.status === "awaiting_funding" && !!ws.termsLockedAt && m === current) ||
        m.status === "in_review" ||
        m.status === "ready_to_release"
      );
    if (fl) return m.status === "funded_sim" || m.status === "revision_requested";
    return false;
  });
}

/** Tab mặc định khi mở workspace: tranh chấp nếu đang mở, còn lại là Milestones */
export const defaultTab = (ws: Workspace): PanelTab => (openDisputes(ws).length ? "dispute" : "milestones");

/** Thứ tự tab theo ngữ cảnh: tranh chấp mở thì đưa lên đầu */
export function tabOrder(ws: Workspace): PanelTab[] {
  const base: PanelTab[] = ["terms", "milestones", "files", "evidence", "dispute"];
  return openDisputes(ws).length ? ["dispute", ...base.filter((t) => t !== "dispute")] : base;
}

const ACTION_VERB: Partial<Record<Milestone["status"], string>> = {
  awaiting_funding: "Ký quỹ",
  in_review: "Nghiệm thu",
  ready_to_release: "Giải ngân",
  funded_sim: "Nộp sản phẩm",
  revision_requested: "Nộp lại",
};

/** Một dòng "Việc cần làm" cho Status Header */
export function nextAction(ws: Workspace, meId: string): { text: string; tab: PanelTab | null; urgent: "danger" | "amber" | null } {
  const idx = (id: string) => ws.milestones.findIndex((m) => m.id === id) + 1;
  const d = openDisputes(ws)[0];
  if (d) return { text: `Xem hỗ trợ giai đoạn ${idx(d.milestoneId)}`, tab: "dispute", urgent: "danger" };
  if (!ws.termsLockedAt) return { text: "Khóa điều khoản để bắt đầu", tab: "terms", urgent: "amber" };
  const mine = milestonesNeedingMe(ws, meId)[0];
  if (mine) return { text: `${ACTION_VERB[mine.status]} giai đoạn ${idx(mine.id)}`, tab: "milestones", urgent: "amber" };
  if (ws.milestones.every(isClosed)) return { text: "Dự án đã hoàn tất", tab: null, urgent: null };
  return { text: "Dự án đang chạy bình thường", tab: null, urgent: null };
}
