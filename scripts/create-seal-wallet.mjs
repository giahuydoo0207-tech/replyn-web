// Tạo ví niêm phong Solana devnet cho Replyn.
//
//   node scripts/create-seal-wallet.mjs            tạo ví mới, in địa chỉ và khóa bí mật
//   node scripts/create-seal-wallet.mjs --airdrop  tạo ví mới rồi xin 1 SOL devnet (miễn phí) để trả phí giao dịch
//
// Khóa bí mật chỉ in ra màn hình của bạn: chép vào biến môi trường SOLANA_SEAL_SECRET_KEY trên Vercel (hoặc
// .env.local khi chạy thử), rồi xóa khỏi lịch sử terminal nếu cần. Không commit, không gửi qua chat.
// Chỉ dùng cho devnet: ví này không bao giờ được giữ tiền thật.
import { createKeyPairSignerFromBytes, createSolanaRpc, lamports } from "@solana/kit";

const DEVNET = "https://api.devnet.solana.com";

// Khóa phải xuất được để in ra, nên tạo bằng Web Crypto rồi ghép thành 64 byte (32 byte bí mật + 32 byte công khai),
// đúng định dạng file của solana-keygen.
const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const secret = [...pkcs8.slice(-32), ...publicRaw];

// Kit kiểm tra hai nửa khóa khớp nhau; sai thì báo lỗi ngay tại đây.
const signer = await createKeyPairSignerFromBytes(Uint8Array.from(secret));

console.log("\nĐịa chỉ ví niêm phong (công khai, ai xem cũng được):");
console.log(`  ${signer.address}`);
console.log("\nKhóa bí mật (chép nguyên dòng dưới vào SOLANA_SEAL_SECRET_KEY, KHÔNG chia sẻ):");
console.log(`  ${JSON.stringify(secret)}`);

if (process.argv.includes("--airdrop")) {
  const rpc = createSolanaRpc(DEVNET);
  try {
    const sig = await rpc.requestAirdrop(signer.address, lamports(1_000_000_000n)).send();
    console.log(`\nĐã xin 1 SOL devnet. Giao dịch: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch {
    console.log("\nDevnet đang giới hạn airdrop. Vào https://faucet.solana.com, dán địa chỉ ở trên, chọn Devnet để nhận SOL thử nghiệm.");
  }
} else {
  console.log("\nVí cần một ít SOL devnet để trả phí: vào https://faucet.solana.com, dán địa chỉ ở trên, chọn Devnet.");
}
console.log("Mỗi lần niêm phong tốn khoảng 0,000005 SOL; 1 SOL devnet đủ cho hàng trăm nghìn lần.\n");
