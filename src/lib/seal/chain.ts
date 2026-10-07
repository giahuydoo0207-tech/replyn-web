import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signature as toSignature,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";
import { parseSealMemo, type SealCluster } from "./agreement";

/**
 * Ghi và tra niêm phong trên Solana. Chuỗi chính là nơi lưu: mỗi niêm phong là một giao dịch Memo do ví niêm phong
 * của Replyn ký, nên tra lại chỉ cần đọc lịch sử giao dịch của ví đó, không cần cơ sở dữ liệu riêng.
 * Chỉ chạy trên devnet; RPC trỏ sang mạng khác thì từ chối.
 */

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const DEFAULT_RPC = "https://api.devnet.solana.com";
const PAGE_SIZE = 1000;
/** Đọc tối đa ngần này trang lịch sử; quá thì báo không xác định thay vì kết luận "chưa niêm phong". */
const MAX_PAGES = 20;
/** Số giao dịch ứng viên tối đa được đọc chi tiết cho một workspace (chặn giao dịch rác giả memo). */
const MAX_CANDIDATES = 8;
const CONFIRM_ATTEMPTS = 15;
const CONFIRM_DELAY_MS = 1000;

export interface FoundSeal {
  signature: string;
  hash: string;
  /** Giây Unix theo block; null nếu RPC chưa có. */
  blockTime: number | null;
}

/** Không đọc hết được lịch sử ví (quá dài hoặc bị spam): không được coi là "chưa niêm phong". */
export class SealLookupIncomplete extends Error {
  constructor() {
    super("seal history too long to scan");
  }
}

export interface SealChain {
  cluster: SealCluster;
  sealer: string;
  /** Niêm phong sớm nhất của workspace, do chính ví niêm phong trả phí và ký. */
  findSeal(workspaceId: string): Promise<FoundSeal | null>;
  /** Gửi giao dịch Memo và chờ xác nhận; trả chữ ký giao dịch. */
  send(memo: string): Promise<string>;
}

export interface SealEnv {
  SOLANA_SEAL_SECRET_KEY?: string;
  SOLANA_SEAL_RPC_URL?: string;
}

/** Khóa bí mật dạng mảng JSON 64 số (như file của solana-keygen). Sai định dạng thì coi như chưa cấu hình. */
export function readSealSecret(env: SealEnv): Uint8Array | null {
  const raw = env.SOLANA_SEAL_SECRET_KEY?.trim();
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      return null;
    }
    return Uint8Array.from(parsed as number[]);
  } catch {
    return null;
  }
}

let cached: { key: string; chain: Promise<SealChain | null> } | null = null;

/** Chuỗi niêm phong thật; null khi chưa cấu hình ví. Lỗi kết nối hoặc sai mạng sẽ ném ra ở lần gọi. */
export function liveSealChain(env: SealEnv = process.env as SealEnv): Promise<SealChain | null> {
  const key = `${env.SOLANA_SEAL_SECRET_KEY ?? ""}|${env.SOLANA_SEAL_RPC_URL ?? ""}`;
  if (cached?.key === key) return cached.chain;
  const chain = (async () => {
    const secret = readSealSecret(env);
    if (!secret) return null;
    const signer = await createKeyPairSignerFromBytes(secret);
    return rpcSealChain(createSolanaRpc(env.SOLANA_SEAL_RPC_URL?.trim() || DEFAULT_RPC), signer);
  })();
  cached = { key, chain };
  chain.catch(() => { cached = null; });
  return chain;
}

type Rpc = ReturnType<typeof createSolanaRpc>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function rpcSealChain(rpc: Rpc, signer: KeyPairSigner): SealChain {
  let checkedNetwork = false;
  const found = new Map<string, FoundSeal>();
  const ensureDevnet = async () => {
    if (checkedNetwork) return;
    if ((await rpc.getGenesisHash().send()) !== DEVNET_GENESIS) throw new Error("seal RPC is not Solana devnet");
    checkedNetwork = true;
  };

  return {
    cluster: "devnet",
    sealer: signer.address,

    async findSeal(workspaceId) {
      const hit = found.get(workspaceId);
      if (hit) return hit;
      await ensureDevnet();
      // Đi hết lịch sử của ví (mới nhất trước) để chắc chắn tìm được niêm phong ĐẦU TIÊN, kể cả khi ví đã niêm phong
      // rất nhiều workspace. Chỉ giữ ứng viên khớp memo; mỗi trang tối đa 1000 giao dịch.
      const candidates: { signature: Signature; hash: string; blockTime: number | null }[] = [];
      let before: Signature | undefined;
      for (let page = 0; ; page++) {
        if (page === MAX_PAGES) throw new SealLookupIncomplete();
        const history = await rpc
          .getSignaturesForAddress(signer.address, { limit: PAGE_SIZE, commitment: "confirmed", ...(before ? { before } : {}) })
          .send();
        for (const entry of history) {
          if (entry.err) continue;
          const parsed = parseSealMemo(entry.memo);
          if (parsed?.workspaceId === workspaceId) {
            candidates.push({ signature: entry.signature, hash: parsed.hash, blockTime: entry.blockTime === null ? null : Number(entry.blockTime) });
          }
        }
        if (history.length < PAGE_SIZE) break;
        before = history[history.length - 1].signature;
      }
      // Cũ nhất trước. Ai cũng có thể nhắc tới địa chỉ ví trong giao dịch của họ, nên chỉ tin giao dịch do chính ví
      // niêm phong trả phí (tài khoản đầu tiên là người trả phí, cả với giao dịch legacy lẫn v0).
      let checked = 0;
      for (const candidate of candidates.reverse()) {
        if (checked++ === MAX_CANDIDATES) throw new SealLookupIncomplete();
        const tx = await rpc
          .getTransaction(candidate.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" })
          .send()
          .catch(() => null);
        if (tx?.transaction.message.accountKeys[0] !== signer.address || tx.meta?.err) continue;
        // Niêm phong đầu tiên không bao giờ đổi, nên giữ lại để lần sau khỏi gọi RPC.
        found.set(workspaceId, candidate);
        return candidate;
      }
      return null;
    },

    async send(memo) {
      await ensureDevnet();
      const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
        (m) => appendTransactionMessageInstructions([getAddMemoInstruction({ memo, signers: [signer] })], m),
      );
      const signed = await signTransactionMessageWithSigners(message);
      const signature = getSignatureFromTransaction(signed);
      await rpc
        .sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" })
        .send();
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        const { value } = await rpc.getSignatureStatuses([toSignature(signature)], { searchTransactionHistory: true }).send();
        const status = value[0];
        if (status?.err) throw new Error("seal transaction failed");
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
        await sleep(CONFIRM_DELAY_MS);
      }
      throw new Error("seal transaction not confirmed in time");
    },
  };
}
