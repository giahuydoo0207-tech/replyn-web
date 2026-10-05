import type { Metadata } from "next";
import { ReplynApp } from "@/components/ReplynApp";

export const metadata: Metadata = {
  title: "Workspace — Replyn",
  // Đường dẫn chỉ có id mờ của workspace, nhưng vẫn không gửi nó cho trang khác qua Referer.
  referrer: "no-referrer",
};

/**
 * Workspace mở từ đề xuất Nova đã được chấp nhận. Id chỉ là chỉ dẫn: server Replyn kiểm tra người đang đăng
 * nhập có thuộc workspace không trước khi trả bất cứ dữ liệu nào.
 */
export default async function WorkspaceRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplynApp workspaceId={id} />;
}
