"use client";

import { Archive, Download, FileCheck2, FolderOpen, History, Layers, LifeBuoy, LoaderCircle, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { buildDisputePack, packSummary, type DisputePack } from "@/lib/disputePack";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { Button, cx } from "../ui";

const slug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "du-an";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPdf(pack: DisputePack) {
  const [{ buildDisputePackPdf }, regular, semibold] = await Promise.all([
    import("@/lib/disputePackPdf"),
    fetch("/fonts/BeVietnamPro-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/BeVietnamPro-SemiBold.ttf").then((r) => r.arrayBuffer()),
  ]);
  const bytes = await buildDisputePackPdf(pack, { regular, semibold });
  save(new Blob([bytes as BlobPart], { type: "application/pdf" }), `Ho-so-ho-tro-${slug(pack.workspace.title)}.pdf`);
}

/** Dòng tóm tắt dùng trong hộp thoại yêu cầu hỗ trợ. */
export function usePackSummary(wsId: string) {
  const { state } = useStore();
  return useMemo(() => {
    const pack = buildDisputePack(state, wsId);
    return pack ? packSummary(pack) : null;
  }, [state, wsId]);
}

/**
 * Hồ sơ gửi kèm khi yêu cầu hỗ trợ: Replyn tự gom, hai bên đều xem được gồm những gì và tải về được, không ai sửa được.
 */
export function DisputePackCard({ ws }: { ws: Workspace }) {
  const { state } = useStore();
  const pack = useMemo(() => buildDisputePack(state, ws.id), [state, ws.id]);
  const [busy, setBusy] = useState<"idle" | "busy" | "failed">("idle");
  if (!pack) return null;
  const s = packSummary(pack);
  const active = ws.disputes.some((d) => d.status !== "resolved");

  const rows: { icon: LucideIcon; label: string; detail: string }[] = [
    { icon: FileCheck2, label: "Thỏa thuận", detail: s.versions > 1 ? `Phiên bản ${s.versions} · ${s.changes} đề xuất thay đổi` : s.changes ? `${s.changes} đề xuất thay đổi` : "Bản gốc" },
    { icon: Layers, label: "Giai đoạn", detail: `${s.milestones} giai đoạn và trạng thái hiện tại` },
    { icon: FolderOpen, label: "Sản phẩm đã nộp", detail: s.submissions ? `${s.submissions} bản nộp, kèm dấu vân tay tệp` : "Chưa có" },
    { icon: History, label: "Nhật ký dự án", detail: `${s.events} sự kiện` },
    {
      icon: Archive,
      label: "Lưu trữ tin nhắn",
      detail: `${s.messages} tin${s.pinned ? ` · ${s.pinned} đã ghim` : ""}${s.recalled ? ` · ${s.recalled} đã thu hồi` : ""}`,
    },
    { icon: LifeBuoy, label: "Yêu cầu hỗ trợ", detail: s.disputes ? `${s.disputes} yêu cầu` : "Chưa có" },
  ];

  return (
    <section className="rounded-xl bg-panel p-4" aria-label="Hồ sơ gửi kèm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold">Hồ sơ gửi kèm</h3>
          <p className="mt-1 max-w-[60ch] text-[13px] text-ink-2">
            {active
              ? "Replyn đã gửi hồ sơ dự án này cho Đội ngũ hỗ trợ. Hai bên xem được hồ sơ gồm những gì, không ai sửa được."
              : "Khi có yêu cầu hỗ trợ, Replyn tự gom hồ sơ dưới đây gửi cho Đội ngũ hỗ trợ. Hai bên xem được, không ai sửa được."}
          </p>
        </div>
        <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold", active ? "bg-amber/15 text-amber" : "bg-white/6 text-ink-2")}>
          {active ? "Đã gửi kèm" : "Sẵn sàng"}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-white/[0.06] rounded-lg bg-white/[0.03] px-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 py-2.5 text-[13px]">
            <r.icon size={15} className="shrink-0 text-ink-2" />
            <span className="w-[120px] shrink-0 font-medium">{r.label}</span>
            <span className="min-w-0 text-ink-2">{r.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy === "busy"}
          onClick={() => {
            setBusy("busy");
            downloadPdf(pack).then(() => setBusy("idle"), () => setBusy("failed"));
          }}
        >
          {busy === "busy" ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
          {busy === "busy" ? "Đang tạo hồ sơ" : "Tải hồ sơ (PDF)"}
        </Button>
        <button
          type="button"
          onClick={() => save(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }), `ho-so-replyn-${slug(pack.workspace.title)}.json`)}
          className="rounded-lg px-2.5 py-2 text-[13px] text-link hover:bg-white/6 active:scale-[0.98]"
        >
          Dữ liệu gốc (JSON)
        </button>
      </div>
      {busy === "failed" && <p role="alert" className="mt-1.5 text-[12px] text-danger">Chưa tạo được file. Thử lại sau ít giây.</p>}
    </section>
  );
}
