import { resolveSessionWorkspace, type AuthDeps } from "../auth/server/novaBusinessAuth";
import {
  agreementHash,
  canonicalAgreement,
  explorerTxUrl,
  isAgreementHash,
  isWorkspaceId,
  sealMemo,
  type CanonicalAgreement,
  type SealCluster,
} from "./agreement";
import type { SealChain } from "./chain";

/**
 * API niêm phong:
 * - GET/POST /api/workspaces/{id}/seal (cần phiên, chỉ hai bên của workspace): xem trạng thái; POST niêm phong nếu chưa có.
 * - GET /api/seal/verify?workspaceId=&hash= (công khai): đối chiếu một mã băm với niêm phong trên chuỗi.
 * Không bao giờ trả khóa bí mật hay thông tin cấu hình; lỗi chuỗi chỉ báo "unavailable".
 */

export type SealView =
  | { status: "disabled" | "unsealed" | "unavailable"; hash: string; agreement: CanonicalAgreement }
  | {
      status: "sealed" | "mismatch";
      hash: string;
      sealedHash: string;
      agreement: CanonicalAgreement;
      signature: string;
      sealedAt: string | null;
      cluster: SealCluster;
      explorerUrl: string;
    };

export type VerifyView =
  | { found: false }
  | { found: true; matches: boolean; signature: string; sealedAt: string | null; cluster: SealCluster; explorerUrl: string };

export type ChainProvider = () => Promise<SealChain | null>;

const pending = new Map<string, Promise<string>>();

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const sealedAt = (blockTime: number | null) => (blockTime === null ? null : new Date(blockTime * 1000).toISOString());

export async function handleSeal(
  request: Request,
  deps: AuthDeps,
  getChain: ChainProvider,
  workspaceId: string,
): Promise<Response> {
  const resolved = await resolveSessionWorkspace(request, deps, workspaceId);
  if (resolved.kind === "error") return resolved.response;
  const agreement = canonicalAgreement(resolved.workspace);
  if (!agreement) return respond(503, { error: "unavailable" });
  const id = agreement.workspaceId;
  const hash = await agreementHash(agreement);

  let chain: SealChain | null;
  try {
    chain = await getChain();
  } catch {
    return respond(200, { status: "unavailable", hash, agreement } satisfies SealView);
  }
  if (!chain) return respond(200, { status: "disabled", hash, agreement } satisfies SealView);

  try {
    const found = await chain.findSeal(id);
    if (found) {
      return respond(200, {
        status: found.hash === hash ? "sealed" : "mismatch",
        hash,
        sealedHash: found.hash,
        agreement,
        signature: found.signature,
        sealedAt: sealedAt(found.blockTime),
        cluster: chain.cluster,
        explorerUrl: explorerTxUrl(found.signature, chain.cluster),
      } satisfies SealView);
    }
    if (request.method !== "POST") return respond(200, { status: "unsealed", hash, agreement } satisfies SealView);

    // Hai bên có thể cùng mở workspace: trong cùng một instance chỉ gửi một giao dịch cho mỗi workspace.
    let sending = pending.get(id);
    if (!sending) {
      sending = chain.send(sealMemo(id, hash)).finally(() => pending.delete(id));
      pending.set(id, sending);
    }
    const signature = await sending;
    return respond(200, {
      status: "sealed",
      hash,
      sealedHash: hash,
      agreement,
      signature,
      sealedAt: new Date(deps.now()).toISOString(),
      cluster: chain.cluster,
      explorerUrl: explorerTxUrl(signature, chain.cluster),
    } satisfies SealView);
  } catch {
    return respond(200, { status: "unavailable", hash, agreement } satisfies SealView);
  }
}

export async function handleVerify(request: Request, getChain: ChainProvider): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const workspaceId = params.get("workspaceId")?.toLowerCase();
  const hash = params.get("hash")?.toLowerCase();
  if (!isWorkspaceId(workspaceId) || !isAgreementHash(hash)) return respond(400, { error: "invalid_request" });
  let chain: SealChain | null;
  try {
    chain = await getChain();
  } catch {
    return respond(503, { error: "unavailable" });
  }
  if (!chain) return respond(503, { error: "not_configured" });
  try {
    const found = await chain.findSeal(workspaceId);
    if (!found) return respond(200, { found: false } satisfies VerifyView);
    return respond(200, {
      found: true,
      matches: found.hash === hash,
      signature: found.signature,
      sealedAt: sealedAt(found.blockTime),
      cluster: chain.cluster,
      explorerUrl: explorerTxUrl(found.signature, chain.cluster),
    } satisfies VerifyView);
  } catch {
    return respond(503, { error: "unavailable" });
  }
}
