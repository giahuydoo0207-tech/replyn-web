import type { Metadata } from "next";
import { VerifyPage } from "@/components/seal/VerifyPage";

export const metadata: Metadata = {
  title: "Kiểm chứng thỏa thuận - Replyn",
  description: "Kiểm tra một bản thỏa thuận Replyn có đúng bản gốc hai bên đã chốt không.",
};

/** Trang công khai: ai có file thỏa thuận cũng tự kiểm tra được, không cần đăng nhập. */
export default function VerifyRoute() {
  return <VerifyPage />;
}
