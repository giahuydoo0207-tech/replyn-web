"use client";

import { ChevronRight } from "lucide-react";
import { usdc } from "@/lib/fees";
import { nextAction, openDisputes } from "@/lib/protection";
import { useActiveChat, useMe, useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { Avatar, cx } from "../ui";

/** Status Header cố định ở đầu panel — thay cho tab "Tổng quan" */
export function StatusHeader({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const { conv } = useActiveChat();
  const meId = useMe();
  const total = ws.milestones.reduce((a, m) => a + m.amount, 0);
  const inReview = ws.milestones.filter((m) => m.status === "in_review").length;
  const disputes = openDisputes(ws).length;
  const next = nextAction(ws, meId);

  return (
    <section aria-label="Trạng thái dự án" className="shrink-0 border-b border-white/5 px-4 pb-3 pt-3.5">
      <div className="flex items-start gap-3">
        {conv && <Avatar {...conv.avatar} size={40} />}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight">{ws.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-2">
            {state.users[ws.businessId].name} · {state.users[ws.freelancerId].name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-semibold">{usdc(total)}</p>
          <p className="text-[11px] text-muted">{ws.feeTier === "BASIC" ? "BASIC 7%" : "ADVANCED 10%"} (mô phỏng)</p>
        </div>
      </div>

      <p className="mt-2.5 text-[13px] text-ink-2">
        {ws.milestones.length} milestone · {inReview} đang chờ nghiệm thu ·{" "}
        <span className={cx(disputes > 0 && "text-[#ff8f8f]")}>{disputes} tranh chấp</span>
      </p>

      {next.tab ? (
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_PANEL", tab: next.tab!, open: true })}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-left text-[13px] hover:bg-white/[0.08]"
        >
          <span
            className={cx("size-2 shrink-0 rounded-full", next.urgent === "danger" ? "bg-danger" : "bg-amber")}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted">Việc cần làm: </span>
            <span className="font-medium text-ink">{next.text}</span>
          </span>
          <ChevronRight size={15} className="shrink-0 text-muted" />
        </button>
      ) : (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[13px] text-ink-2">
          <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
          {next.text}
        </p>
      )}
    </section>
  );
}
