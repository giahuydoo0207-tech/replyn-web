import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NovaAuthPage } from "@/components/auth/NovaAuthPage";

export const metadata: Metadata = {
  title: "Tiếp tục với Nova — Replyn",
  description: "Xác minh tài khoản Nova để mở cuộc trò chuyện và hồ sơ công việc của bạn trên Replyn.",
  // URL mã QR mở nhầm trong trình duyệt có secret một lần; không gửi nó qua Referer.
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#0c1317",
};

// NovaAuthPage đọc query handoff bằng useSearchParams nên cần Suspense khi prerender
export default function NovaAuthRoute() {
  return (
    <Suspense fallback={<div className="nova-auth h-dvh" />}>
      <NovaAuthPage />
    </Suspense>
  );
}
