import { liveSealChain } from "@/lib/seal/chain";
import { handleVerify } from "@/lib/seal/handlers";

/** Công khai: đối chiếu mã băm của một bản thỏa thuận với niêm phong trên chuỗi. */
export async function GET(request: Request) {
  return handleVerify(request, () => liveSealChain());
}
