import { currentVersion } from "../scopeChange";
import type { User, Workspace } from "../types";
import { canonicalAgreement, type CanonicalAgreement } from "./agreement";

/** "15/10/2026" -> "2026-10-15"; sai dạng thì null. */
const isoDay = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const unique = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))];

/**
 * Bản thỏa thuận của một workspace đã được hai bên xác nhận, dựng từ các giai đoạn đang hiện hành. Chưa xác nhận thì
 * chưa có thỏa thuận (null). Đổi phạm vi thì phiên bản tăng và dấu vân tay đổi theo.
 */
export function agreementFromWorkspace(state: { users: Record<string, User> }, ws: Workspace): CanonicalAgreement | null {
  if (!ws.termsLockedAt) return null;
  const ms = ws.milestones;
  const scope = ms
    .map((m, i) => `Giai đoạn ${i + 1}: ${m.title}${m.scope ? `. ${m.scope}` : ""}`)
    .join("\n");
  const criteria = unique(ms.flatMap((m) => m.criteria));
  const deliverables = unique(ms.flatMap((m) => m.deliverables ?? []));
  const deadlines = ms.map((m) => isoDay(m.deadline)).filter((d): d is string => !!d).sort();
  const accepted = new Date(ws.termsLockedAt).toISOString();
  return canonicalAgreement({
    workspaceId: ws.id,
    version: currentVersion(ws),
    projectName: ws.title,
    scope,
    deliverables: deliverables.length > 0 ? deliverables : criteria,
    revisionLimit: ms.length ? Math.max(...ms.map((m) => m.revisionLimit)) : null,
    currency: "USDC",
    totalAmount: ms.reduce((sum, m) => sum + m.amount, 0),
    startDate: accepted.slice(0, 10),
    deadline: deadlines.at(-1) ?? null,
    reviewPeriodDays: ms.length ? Math.max(...ms.map((m) => m.reviewDays)) : null,
    milestones: ms.map((m) => ({ title: m.title, amount: m.amount, deadline: isoDay(m.deadline) })),
    notes: deliverables.length > 0 && criteria.length > 0 ? `Tiêu chí nghiệm thu: ${criteria.join("; ")}` : "",
    acceptedAt: accepted,
    businessName: state.users[ws.businessId]?.name ?? "",
    freelancerName: state.users[ws.freelancerId]?.name ?? "",
  });
}
