"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { chatFace, wsChatId } from "@/lib/reducer";
import { fromInputDate, toInputDate, validTerms } from "@/lib/scopeChange";
import { useStore } from "@/lib/store";
import type { Conversation, MilestoneTerms } from "@/lib/types";
import { Button, cx, Modal } from "../ui";

const field =
  "w-full rounded-lg bg-rail px-3 py-2 text-[14px] ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yellow/60 disabled:opacity-60";

/** Mã workspace ngắn, dễ đọc, khớp định dạng của dấu vân tay: "ws-landing-page-k3f9". */
const newWorkspaceId = (title: string) => {
  const base = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "du-an";
  return `ws-${base}-${Math.random().toString(36).slice(2, 6)}`;
};

/**
 * Doanh nghiệp mở dự án ngay trong cuộc trò chuyện trực tiếp: đặt tên và các giai đoạn. Workspace mở ra ở trạng thái
 * chưa xác nhận; hai bên rà lại trong tab Thỏa thuận rồi mới khóa.
 */
export function OpenProjectDialog({ conv, businessId, freelancerId, onClose }: { conv: Conversation; businessId: string; freelancerId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<MilestoneTerms[]>([{ title: "", amount: 0, deadline: "" }]);
  const [tried, setTried] = useState(false);
  const ok = title.trim().length > 0 && rows.length > 0 && rows.every(validTerms);

  const patch = (i: number, p: Partial<MilestoneTerms>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const create = () => {
    setTried(true);
    if (!ok) return;
    const wsId = newWorkspaceId(title);
    dispatch({
      type: "CREATE_WORKSPACE",
      wsId,
      title: title.trim(),
      businessId,
      freelancerId,
      feeTier: "BASIC",
      fromChat: conv.id,
      draft: rows.map((r, i) => ({ id: `${wsId}-m${i + 1}`, title: r.title.trim(), amount: r.amount, deadline: r.deadline, criteria: [] })),
    });
    dispatch({ type: "SELECT_CHAT", chatId: wsChatId(wsId) });
    onClose();
  };

  return (
    <Modal
      open
      size="lg"
      title="Mở dự án"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={create} aria-disabled={!ok} className={cx(!ok && "opacity-50")}>Mở dự án</Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-2">
        Dự án mở cùng {chatFace(state, conv).title}. Hai bên rà lại và cùng xác nhận trong tab Thỏa thuận trước khi ký quỹ.
      </p>
      <label className="mt-4 block text-[13px] font-medium" htmlFor="project-title">Tên dự án</label>
      <input
        id="project-title"
        className={cx(field, "mt-1.5")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ví dụ: Landing page ra mắt menu mùa thu"
      />
      {tried && !title.trim() && <p className="mt-1 text-[12px] text-danger">Hãy đặt tên dự án.</p>}

      <p className="mt-4 text-[13px] font-medium">Các giai đoạn</p>
      <ol className="mt-1.5 space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="font-medium text-muted">Giai đoạn {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-2 hover:bg-white/6 hover:text-ink">
                  <X size={13} /> Xóa dòng
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_128px_148px]">
              <input aria-label="Tên giai đoạn" className={field} value={r.title} placeholder="Tên giai đoạn" onChange={(e) => patch(i, { title: e.target.value })} />
              <label className="relative">
                <span className="sr-only">Số tiền (USDC)</span>
                <input
                  inputMode="decimal"
                  className={cx(field, "pr-12 tabular-nums")}
                  value={r.amount ? String(r.amount) : ""}
                  placeholder="0"
                  onChange={(e) => patch(i, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) })}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">USDC</span>
              </label>
              <input
                type="date"
                aria-label="Hạn bàn giao"
                className={cx(field, "[color-scheme:dark]")}
                value={toInputDate(r.deadline)}
                onChange={(e) => patch(i, { deadline: fromInputDate(e.target.value) })}
              />
            </div>
            {tried && !validTerms(r) && <p className="mt-1.5 text-[12px] text-danger">Cần tên, số tiền lớn hơn 0 và hạn bàn giao.</p>}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { title: "", amount: 0, deadline: "" }])}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-link hover:bg-white/6"
      >
        <Plus size={15} /> Thêm giai đoạn
      </button>
    </Modal>
  );
}
