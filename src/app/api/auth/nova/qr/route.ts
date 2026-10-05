import { handleQrCreate, handleQrPoll, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

/** Tạo mã QR đăng nhập: Nova backend lưu challenge, trình duyệt chỉ nhận URL để vẽ mã. */
export function POST(request: Request) {
  return handleQrCreate(request, liveAuthDeps());
}

/** Hỏi trạng thái mã QR; khi Nova Mobile đã xác nhận thì đặt cookie phiên Replyn. */
export function GET(request: Request) {
  return handleQrPoll(request, liveAuthDeps());
}
