"use client";

import { me } from "@/lib/reducer";
import { useStore } from "@/lib/store";
import type { Milestone, Workspace } from "@/lib/types";
import { useWorkspaceActions } from "./actions";

export interface MsAction {
  key: string;
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  run: () => void;
}

/** Nút hành động của milestone theo vai trò người đang xem */
export function useMilestoneActions(ws: Workspace, ms: Milestone): { actions: MsAction[]; waiting?: string } {
  const { state, dispatch } = useStore();
  const dialogs = useWorkspaceActions();
  const meId = me(state);
  const isBiz = meId === ws.businessId;
  const isFl = meId === ws.freelancerId;
  const t = { wsId: ws.id, milestoneId: ms.id };
  const disputeBtn: MsAction = { key: "dispute", label: "Mở tranh chấp", variant: "danger", run: () => dialogs.dispute(t) };
  const openDispute = () => dispatch({ type: "SET_PANEL", tab: "dispute", open: true });

  switch (ms.status) {
    case "awaiting_funding":
      if (!ws.termsLockedAt) {
        return {
          actions: [
            { key: "terms", label: "Xem điều khoản", variant: "secondary", run: () => dispatch({ type: "SET_PANEL", tab: "terms", open: true }) },
          ],
          waiting: "Cần khóa điều khoản trước khi ký quỹ",
        };
      }
      return isBiz
        ? { actions: [{ key: "fund", label: "Ký quỹ (mô phỏng)", variant: "primary", run: () => dispatch({ type: "FUND", ...t }) }] }
        : { actions: [], waiting: "Chờ business ký quỹ (mô phỏng)" };
    case "funded_sim":
      return isFl
        ? { actions: [{ key: "submit", label: "Nộp sản phẩm", variant: "primary", run: () => dialogs.submit(t) }] }
        : { actions: [], waiting: "Freelancer đang thực hiện" };
    case "submitted":
    case "in_review":
      return isBiz
        ? {
            actions: [
              { key: "accept", label: "Nghiệm thu", variant: "primary", run: () => dispatch({ type: "ACCEPT", ...t }) },
              ...(ms.revisionsUsed < ms.revisionLimit
                ? [{ key: "revise", label: "Yêu cầu sửa", variant: "secondary" as const, run: () => dialogs.revise(t) }]
                : []),
              disputeBtn,
            ],
          }
        : { actions: isFl ? [disputeBtn] : [], waiting: `Business có ${ms.reviewDays} ngày để nghiệm thu` };
    case "revision_requested":
      return isFl
        ? { actions: [{ key: "resubmit", label: "Nộp lại", variant: "primary", run: () => dialogs.submit(t) }, disputeBtn] }
        : { actions: isBiz ? [disputeBtn] : [], waiting: "Chờ freelancer nộp lại" };
    case "ready_to_release":
      return isBiz
        ? { actions: [{ key: "release", label: "Giải ngân (mô phỏng)", variant: "primary", run: () => dispatch({ type: "RELEASE", ...t }) }] }
        : { actions: [], waiting: "Đủ điều kiện giải ngân, chờ business xác nhận" };
    case "disputed":
      return {
        actions: [{ key: "view", label: "Xem tranh chấp", variant: "danger", run: openDispute }],
        waiting: "Đang tạm giữ, chờ Đội ngũ Nova",
      };
    default:
      return { actions: [] };
  }
}
