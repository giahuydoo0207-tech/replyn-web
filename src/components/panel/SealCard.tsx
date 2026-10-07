"use client";

import { Download, LifeBuoy, RefreshCw, SearchCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { AGREEMENT_FORMAT, type AgreementFile } from "@/lib/seal/agreement";
import type { SealView } from "@/lib/seal/handlers";
import { useStore } from "@/lib/store";
import { SealEmblem } from "../seal/SealEmblem";
import { TechDetails } from "../seal/TechDetails";
import { Button } from "../ui";

export type SealPhase =
  | { kind: "checking" }
  | { kind: "sealing" }
  | { kind: "error" }
  | { kind: "hidden" }
  | { kind: "sealed" | "mismatch"; view: Extract<SealView, { status: "sealed" | "mismatch" }> };

async function requestSeal(workspaceId: string, method: "GET" | "POST"): Promise<SealView | null> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/seal`, { method, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as SealView;
}

const toPhase = (view: SealView | null): SealPhase =>
  !view || view.status === "disabled"
    ? { kind: "hidden" }
    : view.status === "sealed" || view.status === "mismatch"
      ? { kind: view.status, view }
      : { kind: "error" };

/**
 * Niêm phong thỏa thuận: tự chạy lần đầu một trong hai bên mở workspace, người dùng không phải làm gì.
 * Không cấu hình ví niêm phong thì thẻ này không hiện.
 */
export function SealCard({ workspaceId }: { workspaceId: string }) {
  const { dispatch } = useStore();
  const [phase, setPhase] = useState<SealPhase>({ kind: "checking" });

  const load = useCallback(async (alive: () => boolean) => {
    setPhase({ kind: "checking" });
    try {
      const view = await requestSeal(workspaceId, "GET");
      if (!alive()) return;
      if (view?.status !== "unsealed") return setPhase(toPhase(view));
      setPhase({ kind: "sealing" });
      const sealed = await requestSeal(workspaceId, "POST");
      if (alive()) setPhase(toPhase(sealed));
    } catch {
      if (alive()) setPhase({ kind: "error" });
    }
  }, [workspaceId]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => void load(() => alive), 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  return (
    <SealCardView
      phase={phase}
      onRetry={() => void load(() => true)}
      onSupport={() => dispatch({ type: "SET_PANEL", tab: "dispute", open: true })}
    />
  );
}

const timeOf = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? `${hhmm(ms)}, ${ddmmyyyy(ms)}` : null;
};

function downloadAgreement(view: Extract<SealView, { status: "sealed" | "mismatch" }>) {
  const file: AgreementFile = {
    format: AGREEMENT_FORMAT,
    agreement: view.agreement,
    seal: { signature: view.signature, cluster: view.cluster, hash: view.sealedHash },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `thoa-thuan-replyn-${view.agreement.workspaceId.slice(0, 8)}.json`;
  link.click();
  // Một số trình duyệt còn đang tải khi click() trả về; thu hồi sau một nhịp.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Phần hiển thị, tách riêng để xem trước đủ các trạng thái. */
export function SealCardView({ phase, onRetry, onSupport }: { phase: SealPhase; onRetry: () => void; onSupport: () => void }) {
  if (phase.kind === "hidden") return null;

  if (phase.kind === "checking") {
    // Khung xương đúng hình thẻ niêm phong, không dùng vòng xoay chung chung.
    return (
      <section className="flex animate-pulse items-start gap-4 rounded-xl bg-panel p-4" aria-busy="true" aria-label="Đang kiểm tra niêm phong">
        <span className="size-[52px] shrink-0 rounded-full bg-white/8" />
        <span className="flex-1 space-y-2 pt-1">
          <span className="block h-4 w-2/5 rounded bg-white/8" />
          <span className="block h-3 w-4/5 rounded bg-white/6" />
          <span className="block h-3 w-1/4 rounded bg-white/6" />
        </span>
      </section>
    );
  }

  if (phase.kind === "sealing") {
    return (
      <section className="flex items-center gap-4 rounded-xl border border-yellow/20 bg-yellow/[0.05] p-4" aria-live="polite" aria-busy="true">
        <SealEmblem tone="sealing" size={52} />
        <div>
          <h3 className="text-[15px] font-semibold">Đang niêm phong thỏa thuận</h3>
          <p className="mt-0.5 text-[13px] text-ink-2">Replyn đang đóng dấu thỏa thuận hai bên vừa chốt. Thường chỉ mất vài giây.</p>
        </div>
      </section>
    );
  }

  if (phase.kind === "error") {
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-xl bg-panel p-4">
        <SealEmblem tone="offline" size={52} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">Chưa niêm phong được</h3>
          <p className="mt-0.5 text-[13px] text-ink-2">Không kết nối được nơi lưu niêm phong. Thỏa thuận vẫn được giữ nguyên trên Replyn.</p>
        </div>
        <Button onClick={onRetry}><RefreshCw size={14} /> Thử lại</Button>
      </section>
    );
  }

  const { view } = phase;
  const when = timeOf(view.sealedAt);

  if (phase.kind === "mismatch") {
    return (
      <section className="rounded-xl border border-danger/35 bg-danger/[0.07] p-4" aria-label="Thỏa thuận không khớp bản niêm phong">
        <div className="flex items-start gap-4">
          <SealEmblem tone="warning" size={52} />
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-danger">Thỏa thuận này khác bản đã niêm phong</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Điều khoản đang hiển thị không giống bản hai bên đã chốt{when ? ` lúc ${when}` : ""}. Bạn nên tạm dừng ký quỹ
              và giải ngân cho tới khi đội ngũ Replyn kiểm tra.
            </p>
            <Button variant="primary" className="mt-3" onClick={onSupport}><LifeBuoy size={15} /> Yêu cầu hỗ trợ</Button>
          </div>
        </div>
        <TechDetails signature={view.signature} explorerUrl={view.explorerUrl} fingerprint={view.sealedHash} />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-success/25 bg-success/[0.06] p-4" aria-label="Thỏa thuận đã được niêm phong">
      <div className="flex items-start gap-4">
        <SealEmblem tone="sealed" size={52} />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">Thỏa thuận đã được niêm phong</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Không ai, kể cả Replyn, sửa được thỏa thuận này mà không bị phát hiện.
          </p>
          {when && <p className="mt-1.5 text-[12px] tabular-nums text-muted">Niêm phong lúc {when}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => downloadAgreement(view)}><Download size={15} /> Tải bản thỏa thuận</Button>
        <a
          href="/verify"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-white/8 hover:text-ink"
        >
          <SearchCheck size={15} /> Kiểm chứng một bản thỏa thuận
        </a>
      </div>
      <TechDetails signature={view.signature} explorerUrl={view.explorerUrl} fingerprint={view.hash} />
    </section>
  );
}
