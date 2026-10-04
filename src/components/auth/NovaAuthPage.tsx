"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { resolveHandoff, safeReturnTo, type NovaDemoAccount } from "@/lib/auth/mockNova";
import { startTabFromNovaLogin } from "@/lib/auth/demoSession";
import { initialState } from "@/lib/seed";
import { ReplynMark } from "../ui";
import { AuthMethodTabs, panelId, tabId, type AuthMethod } from "./AuthMethodTabs";
import { HandoffSummary } from "./HandoffSummary";
import { NovaMark, SuccessCheck } from "./marks";
import { NovaIdForm } from "./NovaIdForm";
import { NovaQrLogin } from "./NovaQrLogin";

/* Phương thức gần nhất (không chứa dữ liệu nhạy cảm). Chưa chọn: desktop → QR, mobile → Nova ID. */
const METHOD_KEY = "replyn.auth.method";
const DESKTOP = "(min-width: 768px)";

function readPreferredMethod(): AuthMethod {
  try {
    const v = localStorage.getItem(METHOD_KEY);
    if (v === "qr" || v === "id") return v;
  } catch {
    // localStorage bị chặn
  }
  return window.matchMedia(DESKTOP).matches ? "qr" : "id";
}

function subscribeViewport(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * MOCK — đăng nhập Replyn bằng danh tính Nova. Mọi xác thực ở đây là mô phỏng phía client.
 * Backend thật phải xác minh signed handoff thay vì tin query `handoff` / `conversation` / `returnTo`.
 */
export function NovaAuthPage() {
  const params = useSearchParams();
  const router = useRouter();
  const preferred = useSyncExternalStore(subscribeViewport, readPreferredMethod, () => "qr" as AuthMethod);
  const [chosen, setChosen] = useState<AuthMethod | null>(null);
  const [signedIn, setSignedIn] = useState<{ name: string; toConversation: boolean } | null>(null);
  const method = chosen ?? preferred;
  const handoffParam = params.get("handoff");
  const conversationParam = params.get("conversation");
  const handoff = useMemo(() => resolveHandoff(handoffParam, conversationParam), [handoffParam, conversationParam]);
  const returnTo = safeReturnTo(params.get("returnTo"));

  const choose = (m: AuthMethod) => {
    setChosen(m);
    try {
      localStorage.setItem(METHOD_KEY, m);
    } catch {
      // bỏ qua
    }
  };

  const onSuccess = useCallback(
    (account: NovaDemoAccount) => {
      // chỉ mở cuộc trò chuyện nếu tài khoản vừa xác minh là thành viên của nó
      const conversation = handoff && handoff.members.some((m) => m.id === account.userId) ? handoff.conversationId : null;
      const name = initialState().users[account.userId]?.name ?? account.novaId;
      setSignedIn({ name, toConversation: !!conversation });
      startTabFromNovaLogin(account.role, conversation);
      window.setTimeout(() => router.replace(conversation ? "/" : (returnTo ?? "/")), 900);
    },
    [handoff, returnTo, router],
  );

  const panels: { m: AuthMethod; side: "left" | "right" }[] = [
    { m: "id", side: "left" },
    { m: "qr", side: "right" },
  ];

  return (
    <div className="nova-auth flex h-dvh flex-col overflow-y-auto px-4 py-6 md:py-10">
      <section aria-labelledby="nova-auth-title" className="mx-auto my-auto w-full max-w-[840px] rounded-lg border border-(--na-border) bg-(--na-surface)">
        {/* 1. brand header */}
        <header className="flex items-center gap-3 border-b border-(--na-border) px-5 py-4 sm:px-8">
          <ReplynMark size={28} />
          <span className="text-[17px] font-bold">Replyn</span>
          <span className="h-4 w-px bg-(--na-border)" aria-hidden />
          <span className="flex items-center gap-1.5 text-[14px] text-(--na-ink-2)">
            <NovaMark size={18} /> Đăng nhập qua Nova
          </span>
        </header>

        {/* 2–3. tiêu đề, handoff, tab */}
        <div className="space-y-5 px-5 pb-6 pt-6 sm:px-8 sm:pt-7">
          <div>
            <h1 id="nova-auth-title" className="text-[26px] font-semibold tracking-tight sm:text-[28px]">
              Tiếp tục với Nova
            </h1>
            <p className="mt-1.5 max-w-[560px] text-[15px] text-(--na-ink-2)">
              Xác minh tài khoản Nova để mở cuộc trò chuyện và hồ sơ công việc của bạn trên Replyn.
            </p>
          </div>
          {handoff && <HandoffSummary info={handoff} />}
          <AuthMethodTabs value={method} onChange={(m) => !signedIn && choose(m)} />
        </div>

        {/* 4. nội dung hai cột: hai panel chồng trong một ô grid nên khung không đổi kích thước khi đổi tab */}
        <div className="na-panels border-t border-(--na-border) px-5 py-6 sm:px-8 sm:py-8">
          {panels.map(({ m, side }) => {
            const active = !signedIn && method === m;
            return (
              <div
                key={m}
                id={panelId(m)}
                role="tabpanel"
                aria-labelledby={tabId(m)}
                data-side={side}
                data-active={active}
                className="na-panel"
              >
                {m === "id" ? (
                  <NovaIdForm onSuccess={onSuccess} />
                ) : (
                  <NovaQrLogin active={active} onSuccess={onSuccess} onUseNovaId={() => choose("id")} />
                )}
              </div>
            );
          })}
          {signedIn && (
            <div className="na-fade flex flex-col items-center justify-center gap-3 py-8 text-center [grid-area:1/1]" role="status">
              <SuccessCheck size={52} />
              <p className="text-[18px] font-semibold">Đã xác minh tài khoản Nova</p>
              <p className="text-[14px] text-(--na-ink-2)">
                {signedIn.name} · {signedIn.toConversation ? "Đang mở cuộc trò chuyện…" : "Đang mở danh sách trò chuyện…"}
              </p>
            </div>
          )}
        </div>

        {/* 5. dòng bảo mật */}
        <footer className="flex items-start gap-2 border-t border-(--na-border) px-5 py-4 text-[13px] text-(--na-ink-2) sm:px-8">
          <ShieldCheck size={16} className="mt-px shrink-0 text-(--na-muted)" aria-hidden />
          Replyn chỉ liên kết danh tính và cuộc trò chuyện bạn đã cho phép.
        </footer>
      </section>
      <p className="mt-4 text-center text-[12px] text-(--na-muted)">Bản demo: đăng nhập được mô phỏng trên trình duyệt, chưa kết nối Nova.</p>
    </div>
  );
}