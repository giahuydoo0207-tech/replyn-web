"use client";

import { FileUp, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { usdc } from "@/lib/fees";
import { ddmmyyyy, hhmm } from "@/lib/format";
import { agreementHash, canonicalAgreement, type CanonicalAgreement } from "@/lib/seal/agreement";
import type { VerifyView } from "@/lib/seal/handlers";
import { Button, cx, ReplynMark } from "../ui";
import { SealEmblem } from "./SealEmblem";
import { TechDetails } from "./TechDetails";

export type VerifyState =
  | { kind: "idle" }
  | { kind: "checking"; fileName: string }
  | { kind: "invalid"; fileName: string }
  | { kind: "error"; fileName: string }
  | { kind: "not_found"; fileName: string; agreement: CanonicalAgreement; hash: string }
  | { kind: "match" | "modified"; fileName: string; agreement: CanonicalAgreement; hash: string; seal: Extract<VerifyView, { found: true }> };

const MAX_JSON_BYTES = 256 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

const timeOf = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? `${hhmm(ms)}, ${ddmmyyyy(ms)}` : null;
};

/**
 * Đọc file người dùng thả vào: bản PDF tải từ Replyn (đọc dữ liệu gốc đính kèm bên trong), file JSON tải từ Replyn
 * (có `agreement`) hoặc chính bản thỏa thuận. Mọi thứ diễn ra trên máy người dùng.
 */
async function readAgreement(file: File): Promise<CanonicalAgreement | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    let raw: unknown;
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
      if (file.size > MAX_PDF_BYTES) return null;
      const { readAgreementFromPdf } = await import("@/lib/seal/pdf");
      raw = await readAgreementFromPdf(await file.arrayBuffer());
    } else {
      if (file.size > MAX_JSON_BYTES) return null;
      raw = JSON.parse(await file.text());
    }
    const inner = raw && typeof raw === "object" && "agreement" in raw ? (raw as { agreement: unknown }).agreement : raw;
    return canonicalAgreement(inner);
  } catch {
    return null;
  }
}

export function VerifyPage() {
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const lastFile = useRef<File | null>(null);

  const check = async (file: File) => {
    lastFile.current = file;
    setState({ kind: "checking", fileName: file.name });
    const agreement = await readAgreement(file);
    if (!agreement) return setState({ kind: "invalid", fileName: file.name });
    const hash = await agreementHash(agreement);
    try {
      const res = await fetch(`/api/seal/verify?workspaceId=${encodeURIComponent(agreement.workspaceId)}&hash=${hash}`, { cache: "no-store" });
      if (!res.ok) return setState({ kind: "error", fileName: file.name });
      const view = (await res.json()) as VerifyView;
      if (!view.found) return setState({ kind: "not_found", fileName: file.name, agreement, hash });
      setState({ kind: view.matches ? "match" : "modified", fileName: file.name, agreement, hash, seal: view });
    } catch {
      setState({ kind: "error", fileName: file.name });
    }
  };

  return (
    <VerifyPageView
      state={state}
      onFile={(file) => void check(file)}
      onReset={() => setState({ kind: "idle" })}
      onRetry={() => lastFile.current && void check(lastFile.current)}
    />
  );
}

/** Phần hiển thị, tách riêng để xem trước đủ các trạng thái. */
export function VerifyPageView({
  state,
  onFile,
  onReset,
  onRetry,
}: {
  state: VerifyState;
  onFile: (file: File) => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-app text-ink">
      <header className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg text-[15px] font-semibold">
          <ReplynMark size={30} />
          Replyn
        </Link>
        <Link href="/" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-white/6 hover:text-ink">Mở Replyn</Link>
      </header>

      {/* Mobile: giới thiệu, ô kiểm tra, rồi mới tới hướng dẫn, để người dùng thấy ô thả file ngay. */}
      <main className="mx-auto grid max-w-[1080px] gap-x-16 gap-y-8 px-5 pb-16 pt-8 sm:px-8 md:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr]">
        <section className="max-w-[460px]">
          <h1 className="text-balance text-[30px] font-semibold leading-[1.15] tracking-tight sm:text-[36px]">
            Thỏa thuận này có đúng bản gốc không?
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
            Thả file PDF thỏa thuận tải từ Replyn. Nội dung không rời máy bạn, chỉ dấu vân tay được đem đối chiếu.
          </p>
        </section>

        <section aria-live="polite" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {state.kind === "idle" ? <DropZone onFile={onFile} /> : <Result state={state} onReset={onReset} onRetry={onRetry} />}
        </section>

        <section aria-label="Cách kiểm tra" className="max-w-[460px] lg:col-start-1 lg:row-start-2">
          <ol className="space-y-5 lg:mt-1">
            {[
              ["Lấy file", "Trong workspace, mở tab Thỏa thuận và bấm Tải bản thỏa thuận (PDF)."],
              ["Thả vào ô kiểm tra", "Kéo file PDF vào, hoặc bấm để chọn file trên máy."],
              ["Đọc kết quả", "Xanh là đúng bản gốc, đỏ là file đã bị sửa, vàng là chưa tìm thấy niêm phong."],
            ].map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                <span className="grid size-7 place-items-center rounded-full border border-white/12 text-[13px] font-medium tabular-nums text-ink-2">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[14px] font-medium">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: FileList | null) => files?.[0] && onFile(files[0]);
  const drag = (on: boolean) => (e: DragEvent) => {
    e.preventDefault();
    setOver(on);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={drag(true)}
        onDragLeave={drag(false)}
        onDrop={(e) => {
          drag(false)(e);
          take(e.dataTransfer.files);
        }}
        className={cx(
          "group flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors duration-200 lg:min-h-[340px]",
          over ? "border-yellow bg-yellow/[0.06]" : "border-white/15 bg-panel hover:border-white/30",
        )}
      >
        <span className={cx("grid size-14 place-items-center rounded-2xl transition-colors", over ? "bg-yellow/15 text-yellow" : "bg-white/6 text-ink-2 group-hover:text-ink")}>
          <FileUp size={26} strokeWidth={1.75} />
        </span>
        <span className="mt-5 text-[17px] font-semibold">
          {over ? "Thả file để kiểm tra" : <><span className="md:hidden">Chọn file thỏa thuận</span><span className="hidden md:inline">Kéo file thỏa thuận vào đây</span></>}
        </span>
        <span className="mt-1.5 text-[14px] text-muted">
          <span className="md:hidden">File PDF tải từ Replyn</span><span className="hidden md:inline">hoặc bấm để chọn file PDF</span>
        </span>
      </button>
      {/* Ô chọn file nằm ngoài nút: thẻ <input> không được lồng trong <button>. */}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf,application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function Result({ state, onReset, onRetry }: { state: Exclude<VerifyState, { kind: "idle" }>; onReset: () => void; onRetry: () => void }) {
  if (state.kind === "checking") {
    return (
      <div className="animate-pulse rounded-2xl bg-panel p-6" aria-busy="true" aria-label="Đang đối chiếu">
        <div className="flex items-start gap-4">
          <span className="size-14 shrink-0 rounded-full bg-white/8" />
          <span className="flex-1 space-y-2.5 pt-1.5">
            <span className="block h-5 w-1/3 rounded bg-white/8" />
            <span className="block h-3.5 w-4/5 rounded bg-white/6" />
          </span>
        </div>
        <div className="mt-6 space-y-3 border-t border-white/8 pt-5">
          {[0, 1, 2, 3].map((i) => <span key={i} className="block h-3.5 rounded bg-white/6" style={{ width: `${80 - i * 12}%` }} />)}
        </div>
      </div>
    );
  }

  const fileLine = <p className="truncate text-[12px] text-muted" title={state.fileName}>{state.fileName}</p>;
  const again = <Button onClick={onReset}>Kiểm tra file khác</Button>;

  if (state.kind === "invalid" || state.kind === "error") {
    const invalid = state.kind === "invalid";
    return (
      <div className="seal-reveal rounded-2xl bg-panel p-6">
        {fileLine}
        <div className="mt-3 flex items-start gap-4">
          <SealEmblem tone={invalid ? "warning" : "offline"} size={56} />
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold">{invalid ? "Không đọc được file này" : "Chưa kiểm tra được"}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
              {invalid
                ? "Hãy chọn đúng file PDF tải từ tab Thỏa thuận trong Replyn."
                : "Không kết nối được nơi lưu niêm phong. Thử lại sau ít phút."}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {!invalid && <Button variant="primary" onClick={onRetry}><RefreshCw size={15} /> Thử lại</Button>}
          {again}
        </div>
      </div>
    );
  }

  const { agreement } = state;
  const sealedAt = state.kind === "not_found" ? null : timeOf(state.seal.sealedAt);
  const tone = state.kind === "match" ? "sealed" : state.kind === "modified" ? "warning" : "offline";
  const frame = {
    match: "border-success/25 bg-success/[0.06]",
    modified: "border-danger/35 bg-danger/[0.07]",
    not_found: "border-amber/30 bg-amber/[0.06]",
  }[state.kind];
  const title = { match: "Đúng bản gốc", modified: "File đã bị sửa", not_found: "Chưa tìm thấy niêm phong" }[state.kind];
  const body = {
    match: `File này giống hệt thỏa thuận hai bên đã chốt${sealedAt ? ` và niêm phong lúc ${sealedAt}` : ""}.`,
    modified: "Ít nhất một điều khoản trong file khác với bản gốc đã niêm phong. Đừng dùng file này để đối chiếu.",
    not_found: "Thỏa thuận này chưa được niêm phong, hoặc file không đến từ Replyn.",
  }[state.kind];

  return (
    <div className={cx("seal-reveal rounded-2xl border p-6", frame)}>
      {fileLine}
      <div className="mt-3 flex items-start gap-4">
        <SealEmblem tone={tone} size={56} />
        <div className="min-w-0">
          <h2 className={cx("text-[19px] font-semibold", state.kind === "modified" && "text-danger")}>{title}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{body}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-white/8 pt-4">
        <p className="text-[12px] text-muted">{state.kind === "match" ? "Thỏa thuận" : "Nội dung ghi trong file"}</p>
        <dl className="mt-2 grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
          <Fact k="Dự án" v={agreement.projectName} />
          <Fact k="Doanh nghiệp" v={agreement.businessName} />
          <Fact k="Người thực hiện" v={agreement.freelancerName} />
          <Fact k="Tổng ngân sách" v={usdc(agreement.totalAmount)} />
          <Fact k="Chấp nhận lúc" v={timeOf(agreement.acceptedAt) ?? "—"} />
        </dl>
        {state.kind === "match" && agreement.milestones.length > 0 && (
          <>
            <p className="mt-4 text-[12px] text-muted">Các giai đoạn</p>
            <ol className="mt-1.5 divide-y divide-white/8 text-[14px]">
              {agreement.milestones.map((m, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-1.5">
                  <span className="min-w-0 break-words">{m.title}</span>
                  <span className="shrink-0 tabular-nums text-ink-2">{usdc(m.amount)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Đây là nội dung gốc đã niêm phong. Nếu trang PDF bạn đang xem ghi khác, hãy tin nội dung ở đây.
            </p>
          </>
        )}
      </div>

      {state.kind !== "not_found" && (
        <TechDetails signature={state.seal.signature} explorerUrl={state.seal.explorerUrl} fingerprint={state.hash} />
      )}
      <div className="mt-5">{again}</div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words tabular-nums">{v}</dd>
    </>
  );
}
