import { liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";
import { liveSealChain } from "@/lib/seal/chain";
import { handleSeal } from "@/lib/seal/handlers";

// Gửi và chờ xác nhận một giao dịch Solana có thể mất vài giây.
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Trạng thái niêm phong thỏa thuận của workspace (chỉ hai bên của workspace xem được). */
export async function GET(request: Request, { params }: Params) {
  return handleSeal(request, liveAuthDeps(), () => liveSealChain(), (await params).id);
}

/** Niêm phong nếu chưa có; đã niêm phong thì trả lại niêm phong cũ, không gửi giao dịch mới. */
export async function POST(request: Request, { params }: Params) {
  return handleSeal(request, liveAuthDeps(), () => liveSealChain(), (await params).id);
}
