// Kiểm thử niêm phong thỏa thuận lên Solana. Không gọi mạng: Nova và RPC Solana đều được giả lập.
// Chạy: npm run test:seal
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { register } from "node:module";
import { test } from "node:test";

register("../workspace/ts-resolve.mjs", import.meta.url);
const { agreementHash, canonicalAgreement, canonicalJson, parseSealMemo, sealMemo } = await import("../../src/lib/seal/agreement.ts");
const { handleSeal, handleVerify } = await import("../../src/lib/seal/handlers.ts");
const { DEVNET_GENESIS, readSealSecret, rpcSealChain, SealLookupIncomplete } = await import("../../src/lib/seal/chain.ts");
const { SESSION_COOKIE, signSession } = await import("../../src/lib/auth/server/novaBusinessAuth.ts");
const { generateKeyPairSigner, getAddressEncoder } = await import("@solana/kit");

const ORIGIN = "https://replyn.test";
const SECRET = randomBytes(48).toString("base64url");
const CLIENT_SECRET = randomBytes(32).toString("base64url");
const NOW = Date.UTC(2026, 9, 6, 9, 0, 0);
const nowSec = Math.floor(NOW / 1000);
const WORKSPACE = randomUUID();

const workspace = (overrides = {}) => ({
  workspaceId: WORKSPACE,
  projectName: "Landing page Mộc Coffee",
  scope: "Thiết kế và code landing page.",
  deliverables: ["File Figma", "Mã nguồn"],
  revisionLimit: 2,
  currency: "USDC",
  totalAmount: 2500,
  startDate: "2026-10-12",
  deadline: "2026-11-10",
  reviewPeriodDays: 3,
  milestones: [
    { title: "Thiết kế", amount: 1000, deadline: "2026-10-25" },
    { title: "Code", amount: 1500, deadline: "2026-11-10" },
  ],
  notes: "",
  acceptedAt: "2026-10-05T09:35:00Z",
  businessName: "Mộc Coffee",
  freelancerName: "Lê Minh Khoa",
  viewerRole: "freelancer",
  ...overrides,
});

const deps = (body = { workspaces: [workspace()] }) => ({
  env: { NOVA_API_URL: "https://nova.test", REPLYN_SESSION_SECRET: SECRET, REPLYN_QR_CLIENT_SECRET: CLIENT_SECRET, NODE_ENV: "production" },
  fetch: async () => Response.json(body),
  now: () => NOW,
});
const session = () =>
  signSession({ v: 1, provider: "NOVA", iat: nowSec, exp: nowSec + 3600, subjectType: "TALENT", subjectId: "contractor-minh-anh", displayName: "Lê Minh Khoa", role: "freelancer" }, SECRET);
const call = (method, token = session(), headers = {}) =>
  new Request(`${ORIGIN}/api/workspaces/${WORKSPACE}/seal`, {
    method,
    headers: {
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...(method === "GET" ? { "Sec-Fetch-Site": "same-origin" } : { Origin: ORIGIN }),
      ...headers,
    },
  });

/** Chuỗi giả: ghi nhớ memo đã gửi như một ví niêm phong thật. */
function fakeChain(existing = []) {
  const sent = [];
  const seals = [...existing];
  return {
    sent,
    chain: {
      cluster: "devnet",
      sealer: "Sea1er11111111111111111111111111111111111111",
      async findSeal(id) {
        return seals.find((s) => s.workspaceId === id) ?? null;
      },
      async send(memo) {
        sent.push(memo);
        const parsed = parseSealMemo(memo);
        const signature = `sig${sent.length}`;
        seals.push({ ...parsed, signature, blockTime: nowSec });
        return signature;
      },
    },
  };
}

test("the agreement hash ignores key order and timestamp spelling but changes with any term", async () => {
  const a = canonicalAgreement(workspace());
  const reordered = canonicalAgreement(Object.fromEntries(Object.entries(workspace({ acceptedAt: "2026-10-05T09:35:00.000Z" })).reverse()));
  assert.equal(canonicalJson(a), canonicalJson(reordered));
  assert.equal(await agreementHash(a), await agreementHash(reordered));
  assert.equal(a.acceptedAt, "2026-10-05T09:35:00.000Z");
  assert.equal("viewerRole" in a, false, "who is looking is not part of the agreement");

  const base = await agreementHash(a);
  for (const change of [{ totalAmount: 2000 }, { scope: "Thiết kế landing page." }, { notes: "Thêm 1 trang" },
    { milestones: [{ title: "Thiết kế", amount: 900, deadline: "2026-10-25" }, { title: "Code", amount: 1500, deadline: "2026-11-10" }] }]) {
    assert.notEqual(await agreementHash(canonicalAgreement(workspace(change))), base, JSON.stringify(change));
  }
  assert.match(base, /^[0-9a-f]{64}$/);
  // Đổi tên hiển thị trên Nova hoặc lưu chữ có dấu theo cách khác không làm thỏa thuận bị coi là đã sửa.
  assert.equal(await agreementHash(canonicalAgreement(workspace({ businessName: "Mộc Coffee & Co" }))), base);
  assert.equal(await agreementHash(canonicalAgreement(workspace({ projectName: "Landing page Mộc Coffee".normalize("NFD") }))), base);
});

test("malformed agreements are refused instead of guessed", () => {
  assert.equal(canonicalAgreement(workspace({ workspaceId: "u-khoa" })), null);
  assert.equal(canonicalAgreement(workspace({ totalAmount: "2500" })), null);
  assert.equal(canonicalAgreement(workspace({ acceptedAt: "hôm qua" })), null);
  assert.equal(canonicalAgreement(workspace({ milestones: [{ title: "x" }] })), null);
  assert.equal(canonicalAgreement(null), null);
});

test("seal memos round-trip and are found inside the RPC memo format", () => {
  const hash = "a".repeat(64);
  const memo = sealMemo(WORKSPACE, hash);
  assert.deepEqual(parseSealMemo(memo), { workspaceId: WORKSPACE, hash });
  assert.deepEqual(parseSealMemo(`[${memo.length}] ${memo}`), { workspaceId: WORKSPACE, hash });
  assert.deepEqual(parseSealMemo(`[5] hello; [${memo.length}] ${memo}`), { workspaceId: WORKSPACE, hash });
  assert.equal(parseSealMemo("[12] nova:invoice-1"), null);
  assert.throws(() => sealMemo("not-a-uuid", hash));
});

test("GET shows the hash without sealing; POST seals once and later calls reuse it", async () => {
  const { chain, sent } = fakeChain();
  const before = await (await handleSeal(call("GET"), deps(), async () => chain, WORKSPACE)).json();
  assert.equal(before.status, "unsealed");
  assert.equal(sent.length, 0);
  assert.equal(before.hash, await agreementHash(canonicalAgreement(workspace())));

  const sealed = await (await handleSeal(call("POST"), deps(), async () => chain, WORKSPACE)).json();
  assert.equal(sealed.status, "sealed");
  assert.equal(sent.length, 1);
  assert.equal(sent[0], `replyn:seal:1:${WORKSPACE}:${before.hash}`);
  assert.equal(sealed.explorerUrl, "https://explorer.solana.com/tx/sig1?cluster=devnet");

  const again = await (await handleSeal(call("POST"), deps(), async () => chain, WORKSPACE)).json();
  assert.equal(again.status, "sealed");
  assert.equal(again.signature, "sig1");
  assert.equal(sent.length, 1, "no second transaction");
});

test("terms that differ from the sealed hash are reported as a mismatch", async () => {
  const { chain } = fakeChain([{ workspaceId: WORKSPACE, hash: "b".repeat(64), signature: "old", blockTime: nowSec }]);
  const view = await (await handleSeal(call("GET"), deps(), async () => chain, WORKSPACE)).json();
  assert.equal(view.status, "mismatch");
  assert.equal(view.sealedHash, "b".repeat(64));
});

test("no wallet configured, chain errors and missing sessions never leak details", async () => {
  assert.equal((await (await handleSeal(call("POST"), deps(), async () => null, WORKSPACE)).json()).status, "disabled");
  const broken = { cluster: "devnet", sealer: "x", findSeal: async () => { throw new Error("rpc down: secret"); }, send: async () => "x" };
  const res = await handleSeal(call("POST"), deps(), async () => broken, WORKSPACE);
  const body = await res.json();
  assert.equal(body.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(body), /secret|rpc down/);
  assert.equal((await handleSeal(call("GET", null), deps(), async () => broken, WORKSPACE)).status, 401);
  const crossSite = call("POST", session(), { Origin: "https://evil.test" });
  assert.equal((await handleSeal(crossSite, deps(), async () => broken, WORKSPACE)).status, 403);
  // Workspace của người khác: Nova không trả về thì không niêm phong.
  assert.equal((await handleSeal(call("POST"), deps({ workspaces: [] }), async () => broken, WORKSPACE)).status, 404);
});

test("public verify compares a hash with the sealed one", async () => {
  const hash = "c".repeat(64);
  const { chain } = fakeChain([{ workspaceId: WORKSPACE, hash, signature: "sig9", blockTime: nowSec }]);
  const verify = (q) => handleVerify(new Request(`${ORIGIN}/api/seal/verify?${q}`), async () => chain);
  assert.deepEqual(
    await (await verify(`workspaceId=${WORKSPACE}&hash=${hash}`)).json(),
    { found: true, matches: true, signature: "sig9", sealedAt: new Date(nowSec * 1000).toISOString(), cluster: "devnet", explorerUrl: "https://explorer.solana.com/tx/sig9?cluster=devnet" },
  );
  assert.equal((await (await verify(`workspaceId=${WORKSPACE}&hash=${"d".repeat(64)}`)).json()).matches, false);
  assert.deepEqual(await (await verify(`workspaceId=${randomUUID()}&hash=${hash}`)).json(), { found: false });
  assert.equal((await verify("workspaceId=x&hash=y")).status, 400);
});

test("the seal wallet secret must be a 64-byte JSON array", () => {
  assert.equal(readSealSecret({}), null);
  assert.equal(readSealSecret({ SOLANA_SEAL_SECRET_KEY: "not json" }), null);
  assert.equal(readSealSecret({ SOLANA_SEAL_SECRET_KEY: JSON.stringify(Array(32).fill(1)) }), null);
  assert.equal(readSealSecret({ SOLANA_SEAL_SECRET_KEY: JSON.stringify(Array(64).fill(300)) }), null);
  assert.equal(readSealSecret({ SOLANA_SEAL_SECRET_KEY: JSON.stringify(Array(64).fill(7)) }).length, 64);
});

/** RPC giả tối thiểu cho rpcSealChain: mỗi phương thức trả object có `send()`. */
function fakeRpc({ genesis = DEVNET_GENESIS, history = [], txs = {} } = {}) {
  const wrap = (value) => ({ send: async () => value });
  return {
    getGenesisHash: () => wrap(genesis),
    getSignaturesForAddress: () => wrap(history),
    getTransaction: (sig) => wrap(txs[sig] ?? null),
  };
}

test("on chain, only seals paid by the seal wallet count, and the earliest one wins", async () => {
  const signer = await generateKeyPairSigner();
  const memo = (hash) => `[${sealMemo(WORKSPACE, hash).length}] ${sealMemo(WORKSPACE, hash)}`;
  const paidBy = (payer) => ({ transaction: { message: { accountKeys: [payer] } }, meta: { err: null } });
  const rpc = fakeRpc({
    // Mới nhất trước, như RPC thật.
    history: [
      { signature: "newer", err: null, memo: memo("2".repeat(64)), blockTime: 300n },
      { signature: "forged", err: null, memo: memo("9".repeat(64)), blockTime: 200n },
      { signature: "failed", err: { InstructionError: [0, "Custom"] }, memo: memo("8".repeat(64)), blockTime: 150n },
      { signature: "oldest", err: null, memo: memo("1".repeat(64)), blockTime: 100n },
    ],
    txs: { newer: paidBy(signer.address), forged: paidBy("Attacker1111111111111111111111111111111111"), oldest: paidBy(signer.address) },
  });
  const found = await rpcSealChain(rpc, signer).findSeal(WORKSPACE);
  assert.deepEqual(found, { signature: "oldest", hash: "1".repeat(64), blockTime: 100 });

  const forgedOnly = fakeRpc({ history: [{ signature: "forged", err: null, memo: memo("9".repeat(64)), blockTime: 1n }], txs: { forged: paidBy("Attacker1111111111111111111111111111111111") } });
  assert.equal(await rpcSealChain(forgedOnly, signer).findSeal(WORKSPACE), null);
});

test("a seal wallet pointed at a network other than devnet refuses to work", async () => {
  const signer = await generateKeyPairSigner();
  const mainnet = fakeRpc({ genesis: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" });
  await assert.rejects(rpcSealChain(mainnet, signer).findSeal(WORKSPACE), /not Solana devnet/);
  await assert.rejects(rpcSealChain(mainnet, signer).send("x"), /not Solana devnet/);
});

test("the file downloaded from the agreement tab verifies to the same fingerprint", async () => {
  const agreement = canonicalAgreement(workspace());
  const hash = await agreementHash(agreement);
  // Đúng như SealCard tải về: JSON có thụt lề, kèm thông tin niêm phong.
  const file = JSON.stringify({ format: "replyn-agreement/1", agreement, seal: { signature: "sig1", cluster: "devnet", hash } }, null, 2);
  const reread = canonicalAgreement(JSON.parse(file).agreement);
  assert.equal(await agreementHash(reread), hash);
  // Sửa một con số trong file là mã băm đổi.
  const edited = JSON.parse(file.replace('"totalAmount": 2500', '"totalAmount": 2000')).agreement;
  assert.notEqual(await agreementHash(canonicalAgreement(edited)), hash);
});

test("sending a seal signs a memo transaction with the seal wallet and waits for confirmation", async () => {
  const signer = await generateKeyPairSigner();
  const sent = [];
  let polls = 0;
  const wrap = (value) => ({ send: async () => value });
  const rpc = {
    getGenesisHash: () => wrap(DEVNET_GENESIS),
    getLatestBlockhash: () => wrap({ value: { blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k", lastValidBlockHeight: 100n } }),
    sendTransaction: (wire) => { sent.push(wire); return wrap("ignored"); },
    getSignatureStatuses: () => wrap({ value: [++polls < 2 ? null : { confirmationStatus: "confirmed", err: null }] }),
  };
  const memo = sealMemo(WORKSPACE, "e".repeat(64));
  const signature = await rpcSealChain(rpc, signer).send(memo);
  assert.equal(sent.length, 1);
  const bytes = Buffer.from(sent[0], "base64");
  assert.ok(bytes.includes(Buffer.from(memo)), "the memo text is in the signed transaction");
  assert.ok(bytes.includes(Buffer.from(getAddressEncoder().encode(signer.address))), "paid by the seal wallet");
  assert.match(signature, /^[1-9A-HJ-NP-Za-km-z]{64,88}$/);
  assert.equal(polls, 2);
});

test("a seal history too long to scan is reported as unknown, never as unsealed", async () => {
  const signer = await generateKeyPairSigner();
  let pages = 0;
  const fullPage = Array.from({ length: 1000 }, (_, i) => ({ signature: `s${i}`, err: null, memo: null, blockTime: 1n }));
  const rpc = {
    getGenesisHash: () => ({ send: async () => DEVNET_GENESIS }),
    getSignaturesForAddress: () => ({ send: async () => { pages++; return fullPage; } }),
  };
  await assert.rejects(rpcSealChain(rpc, signer).findSeal(WORKSPACE), SealLookupIncomplete);
  assert.equal(pages, 20);
  // Và vì vậy POST không gửi niêm phong mới đè lên.
  let sent = 0;
  const chain = { cluster: "devnet", sealer: "x", findSeal: async () => { throw new SealLookupIncomplete(); }, send: async () => { sent++; return "x"; } };
  assert.equal((await (await handleSeal(call("POST"), deps(), async () => chain, WORKSPACE)).json()).status, "unavailable");
  assert.equal(sent, 0);
});
