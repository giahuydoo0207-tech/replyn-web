"use client";

import { Download, FileCheck, LoaderCircle, SearchCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AGREEMENT_FORMAT, agreementHash, type AgreementFile, type CanonicalAgreement } from "@/lib/agreement/agreement";
import { agreementFromWorkspace } from "@/lib/agreement/fromWorkspace";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { Emblem } from "../verify/Emblem";
import { TechDetails } from "../verify/TechDetails";
import { Button } from "../ui";

/** Xin Replyn ký xác nhận bản thỏa thuận, để file tải về kiểm chứng được trên trang /verify. */
async function signedFile(agreement: CanonicalAgreement): Promise<AgreementFile> {
  const res = await fetch("/api/agreements/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreement }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`receipt ${res.status}`);
  const body = (await res.json()) as Pick<AgreementFile, "agreement" | "receipt">;
  return { format: AGREEMENT_FORMAT, agreement: body.agreement, receipt: body.receipt };
}

/** Tên file không dấu, dễ gửi qua email/Zalo: "Thoa-thuan-Landing-Page-Moc-Coffee". */
const slug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "thoa-thuan";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Một số trình duyệt còn đang tải khi click() trả về; thu hồi sau một nhịp.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File kỹ thuật cho dev cần đối chiếu: đúng dữ liệu gốc dạng JSON, kèm chữ ký của Replyn. */
async function downloadRaw(agreement: CanonicalAgreement) {
  const file = await signedFile(agreement);
  save(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), `thoa-thuan-replyn-${agreement.workspaceId}-v${agreement.version}.json`);
}

type PdfLocale = "vi" | "en";

/** Bản cho người đọc: PDF trình bày đẹp, có kèm dữ liệu gốc bên trong để trang Kiểm chứng đọc được. */
async function downloadPdf(agreement: CanonicalAgreement, locale: PdfLocale) {
  const [file, { buildAgreementPdf }, regular, semibold] = await Promise.all([
    signedFile(agreement),
    import("@/lib/agreement/pdf"),
    fetch("/fonts/BeVietnamPro-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/BeVietnamPro-SemiBold.ttf").then((r) => r.arrayBuffer()),
  ]);
  const bytes = await buildAgreementPdf(file, { regular, semibold }, {
    locale,
    signedAt: file.receipt?.signedAt ?? null,
    verifyUrl: `${window.location.origin}/verify`,
  });
  const name = `${locale === "en" ? "Agreement" : "Thoa-thuan"}-${slug(agreement.projectName)}-v${agreement.version}.pdf`;
  save(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
}

const LOCALES: { id: PdfLocale; label: string }[] = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "en", label: "English" },
];

/** Nút tải PDF kèm chọn ngôn ngữ: chỉ nhãn được dịch, nội dung hai bên nhập giữ nguyên văn. */
function PdfButton({ agreement }: { agreement: CanonicalAgreement }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const [locale, setLocale] = useState<PdfLocale>("vi");
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button
          disabled={state === "busy"}
          onClick={() => {
            setState("busy");
            downloadPdf(agreement, locale).then(() => setState("idle"), () => setState("failed"));
          }}
        >
          {state === "busy" ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
          {state === "busy" ? "Đang tạo file PDF" : "Tải bản thỏa thuận (PDF)"}
        </Button>
        <span role="group" aria-label="Ngôn ngữ của file PDF" className="inline-flex rounded-lg bg-white/6 p-0.5">
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={locale === l.id}
              onClick={() => setLocale(l.id)}
              className={
                locale === l.id
                  ? "rounded-md bg-white/12 px-2.5 py-1 text-[12px] font-medium text-ink"
                  : "rounded-md px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink"
              }
            >
              {l.label}
            </button>
          ))}
        </span>
      </span>
      {state === "failed" && <span role="alert" className="mt-1 text-[12px] text-danger">Chưa tạo được file. Thử lại sau ít giây.</span>}
    </span>
  );
}

/**
 * Dấu vân tay của thỏa thuận đã chốt: hiện ngay khi hai bên xác nhận, tải được bản PDF/JSON có chữ ký của Replyn để
 * tự kiểm chứng sau này. Chưa xác nhận thì thẻ không hiện.
 */
export function AgreementCard({ ws }: { ws: Workspace }) {
  const { state } = useStore();
  const agreement = useMemo(() => agreementFromWorkspace(state, ws), [state, ws]);
  const [hash, setHash] = useState<{ of: CanonicalAgreement; value: string } | null>(null);

  useEffect(() => {
    if (!agreement) return;
    let alive = true;
    void agreementHash(agreement).then((value) => alive && setHash({ of: agreement, value }));
    return () => {
      alive = false;
    };
  }, [agreement]);

  if (!agreement) return null;
  const fingerprint = hash?.of === agreement ? hash.value : null;

  return (
    <section className="rounded-xl border border-success/25 bg-success/[0.06] p-4" aria-label="Dấu vân tay thỏa thuận">
      <div className="flex items-start gap-4">
        <Emblem tone="sealed" size={52} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <FileCheck size={15} className="text-success" /> Thỏa thuận có dấu vân tay
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Phiên bản {agreement.version}. Tải bản PDF để lưu; ai sửa dù một chữ trong file, trang Kiểm chứng sẽ báo ngay.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PdfButton agreement={agreement} />
        <a
          href="/verify"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-white/8 hover:text-ink"
        >
          <SearchCheck size={15} /> Kiểm chứng một bản thỏa thuận
        </a>
      </div>
      {fingerprint && <TechDetails fingerprint={fingerprint} onDownloadRaw={() => void downloadRaw(agreement)} />}
    </section>
  );
}
