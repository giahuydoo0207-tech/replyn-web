// Kiểm thử màn đăng nhập Replyn bằng Nova + chụp ảnh desktop/mobile cả hai tab.
// Nova ID đi qua server Replyn thật (route + cookie phiên); Nova Business được thay bằng máy chủ giả trên máy.
// Chạy sau `npm run build`: npm run test:login  (script tự chạy `next start` với biến môi trường kiểm thử)
// Hoặc trỏ tới server đang chạy với NOVA_API_URL=http://127.0.0.1:3299: $env:BASE_URL="http://localhost:3000"; npm run test:login
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const LOGIN = `${BASE}/auth/nova`;
const NOVA_PORT = 3299;

/* Nova Business giả: không phải dữ liệu thật, Key sinh ngẫu nhiên cho mỗi lần chạy. */
const NOVA_ID = "NVB-TEST2345";
const NOVA_KEY = `nvk_${randomBytes(32).toString("base64url")}`;
const WRONG_KEY = `nvk_${randomBytes(32).toString("base64url")}`;
const DOWN_ID = "NVB-FAKE5ERR"; // Nova trả 500 cho ID này
const novaCalls = [];
const fakeNova = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    novaCalls.push(body.novaId);
    const reply = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (req.url !== "/api/v1/nova-credentials/verify") return reply(404, {});
    if (body.novaId === DOWN_ID) return reply(500, { error: "internal" });
    if (body.novaId !== NOVA_ID || body.novaKey !== NOVA_KEY) return reply(401, { message: "Nova ID or Nova Key is invalid." });
    // chậm một chút để kiểm tra trạng thái loading và chống gửi lặp
    setTimeout(
      () =>
        reply(200, {
          verified: true,
          subjectType: "ORGANIZATION",
          subjectId: "0f8fad5b-d9cb-469f-a165-70867728950e",
          publicNovaId: NOVA_ID,
          displayName: "Mộc Coffee Studio",
          verifiedAt: new Date().toISOString(),
        }),
      600,
    );
  });
});
await new Promise((resolve) => fakeNova.listen(NOVA_PORT, "127.0.0.1", resolve));

/** Không có BASE_URL: tự chạy bản build production với cấu hình kiểm thử. */
let server = null;
if (!process.env.BASE_URL) {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3210"], {
    env: {
      ...process.env,
      NOVA_API_URL: `http://127.0.0.1:${NOVA_PORT}`,
      REPLYN_SESSION_SECRET: randomBytes(48).toString("base64url"),
    },
    stdio: "ignore",
  });
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(LOGIN)).ok) break;
    } catch {
      // chưa sẵn sàng
    }
    if (i > 60) throw new Error("next start không khởi động được (đã chạy npm run build chưa?)");
    await new Promise((r) => setTimeout(r, 500));
  }
}

mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
// 401/503 (Nova) và 500 (đăng xuất lỗi giả lập) là phản hồi mong đợi; trình duyệt vẫn ghi chúng ra console
const expectedHttpError = /Failed to load resource: the server responded with a status of (401|500|503)/;

async function open(url, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !expectedHttpError.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.getByRole("heading", { name: "Tiếp tục với Nova" }).waitFor();
  return page;
}

const tab = (page, name) => page.getByRole("tab", { name });
// lựa chọn đã lưu được áp sau hydrate nên chờ thay vì đọc ngay
const selected = (page, name) => page.locator('[role="tab"][aria-selected="true"]', { hasText: name }).waitFor({ timeout: 5000 });
const qrImage = (page) => page.getByRole("img", { name: /Mã QR đăng nhập Replyn/ });
const visible = (l, timeout = 5000) => l.first().waitFor({ state: "visible", timeout });

async function shot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, animations: "disabled" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: tràn ngang`);
}

const card = (page) => page.locator('section[aria-labelledby="nova-auth-title"]');

/** Chụp đúng khung QR đã render (kể cả logo giữa) rồi giải mã bằng jsQR trong trình duyệt. */
async function decodeQr(page) {
  const png = await qrImage(page).locator("xpath=..").screenshot({ animations: "disabled" });
  await page.addScriptTag({ path: "node_modules/jsqr/dist/jsQR.js" });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    return window.jsQR(data, img.width, img.height)?.data ?? null;
  }, png.toString("base64"));
}

/** Đổi tab rồi so chiều cao khung đăng nhập (chờ hết crossfade). */
async function heightAfter(page, tabName) {
  await tab(page, tabName).click();
  await page.waitForTimeout(300);
  return (await card(page).boundingBox()).height;
}

async function demoStep(page, label) {
  const details = page.locator("details", { hasText: "Điều khiển demo" });
  if (!(await details.evaluate((d) => d.open))) await details.locator("summary").click();
  await page.getByRole("button", { name: label }).click();
}

try {
  /* 1. Chuyển Nova ID ↔ QR, mặc định QR trên desktop, nhớ lựa chọn */
  const page = await open(LOGIN);
  await selected(page, "Mã QR"); // desktop mặc định chọn Mã QR
  await visible(qrImage(page));
  const decoded = await decodeQr(page);
  assert.ok(decoded?.startsWith(`${BASE}/auth/nova?demo-qr=`), `QR quét được và chỉ chứa URL demo (đọc được: ${decoded})`);
  await shot(page, "login-qr-1440");
  console.log("ok  QR giải mã được từ ảnh chụp (có logo giữa), nội dung là URL demo");
  await tab(page, "Mã QR").focus();
  await page.keyboard.press("ArrowLeft");
  await selected(page, "Nova ID"); // phím mũi tên chuyển tab
  await visible(page.getByRole("tabpanel", { name: "Nova ID" }));
  await shot(page, "login-id-1440");
  await page.reload();
  await page.getByRole("heading", { name: "Tiếp tục với Nova" }).waitFor();
  await selected(page, "Nova ID"); // ghi nhớ phương thức gần nhất
  console.log("ok  Chuyển tab bằng chuột/bàn phím, nhớ lựa chọn");

  /* 2. Validation Nova ID */
  const submit = page.getByRole("button", { name: "Tiếp tục với Nova ID" });
  await submit.click();
  await visible(page.getByText("Nhập Nova ID của bạn."));
  await visible(page.getByText("Nhập Nova Key."));
  const idInput = page.getByRole("textbox", { name: "Nova ID", exact: true });
  await idInput.fill("abc");
  await submit.click();
  await visible(page.getByText(/Nova ID có dạng NVB-XXXXXXXX/));
  await idInput.fill("NVB-7K29Q"); // ID demo 5 ký tự cũ không còn hợp lệ
  await submit.click();
  await visible(page.getByText(/Nova ID có dạng NVB-XXXXXXXX/));
  await idInput.fill("  nvb test 2345 ");
  await idInput.blur();
  assert.equal(await idInput.inputValue(), NOVA_ID, "Tự trim và chuẩn hóa Nova ID");
  assert.equal(await page.getByText("Tài khoản demo").count(), 0, "Không còn tài khoản demo cho Nova ID");
  console.log("ok  Validation: thiếu ID, thiếu Key, ID 5 ký tự cũ, sai định dạng, chuẩn hóa");

  /* 3. Hiện/ẩn Nova Key, Key sai định dạng, sai Key (401), Nova lỗi, popover trợ giúp */
  const keyInput = page.getByLabel("Nova Key", { exact: true });
  await keyInput.fill("SAI-KEY");
  assert.equal(await keyInput.getAttribute("type"), "password");
  await page.getByRole("button", { name: "Hiện Nova Key" }).click();
  assert.equal(await keyInput.getAttribute("type"), "text");
  await page.getByRole("button", { name: "Ẩn Nova Key" }).click();
  assert.equal(await keyInput.getAttribute("type"), "password");
  await keyInput.press("Enter");
  await visible(page.getByText("Nova Key bắt đầu bằng nvk_ và có 47 ký tự."));
  assert.equal(novaCalls.length, 0, "Key sai định dạng không được gửi đi");
  await keyInput.fill(WRONG_KEY);
  await keyInput.press("Enter");
  await visible(page.getByRole("alert").filter({ hasText: "không đúng" }));
  assert.equal(await keyInput.inputValue(), "", "Xóa Nova Key sau khi sai");
  await idInput.fill(DOWN_ID);
  await keyInput.fill(WRONG_KEY);
  await keyInput.press("Enter");
  await visible(page.getByRole("alert").filter({ hasText: "Chưa kết nối được Nova Business" }));
  assert.equal(await keyInput.inputValue(), "", "Xóa Nova Key khi Nova lỗi");
  await page.getByRole("button", { name: "Nova ID của tôi ở đâu?" }).click();
  await visible(page.getByRole("dialog", { name: "Tìm Nova ID" }));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Tìm Nova ID" }).count(), 0, "Escape đóng trợ giúp");
  console.log("ok  Hiện/ẩn Key, Key sai định dạng, sai Key (401), Nova lỗi (503), Escape đóng trợ giúp");

  /* 4. Đăng nhập Nova ID thật (qua server) không có handoff → danh sách chat, vai Business */
  novaCalls.length = 0;
  await idInput.fill(NOVA_ID);
  await keyInput.fill(NOVA_KEY);
  // gửi ba lần trong cùng một tick, trước khi React kịp khóa nút
  await keyInput.evaluate((input) => {
    const form = input.form;
    form.requestSubmit();
    form.requestSubmit();
    form.requestSubmit();
  });
  await visible(page.getByRole("button", { name: "Đang xác thực…" }), 2000);
  await visible(page.getByText("Đã xác minh tài khoản Nova"));
  await visible(page.getByText(/Mộc Coffee Studio/));
  assert.equal(novaCalls.length, 1, "Chỉ gửi một yêu cầu xác minh dù nhấn nhiều lần");
  await page.waitForURL(`${BASE}/`);
  await visible(page.getByRole("region", { name: "Danh sách trò chuyện" }));
  // khu vực tài khoản hiển thị danh tính đã xác minh, không phải tài khoản mẫu
  const accountButton = page.getByRole("button", { name: "Hồ sơ: Mộc Coffee Studio" });
  await visible(accountButton);
  assert.equal(await page.getByRole("button", { name: "Hồ sơ: Trần Thu Hà" }).count(), 0, "Không dùng tên mẫu cho tài khoản");
  assert.equal(await page.getByRole("region", { name: /Trò chuyện:/ }).count(), 0, "Không có handoff: chưa mở chat nào");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "replyn_session");
  assert.ok(session, "Có cookie phiên");
  assert.equal(session.httpOnly, true, "Cookie phiên là HttpOnly");
  assert.equal(session.sameSite, "Lax");
  assert.ok(!session.value.includes(NOVA_KEY.slice(4)), "Cookie không chứa Nova Key");
  assert.equal(await page.evaluate(() => document.cookie.includes("replyn_session")), false, "JS không đọc được cookie phiên");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  assert.ok(!stored.includes(NOVA_KEY.slice(4)), "Nova Key không nằm trong localStorage/sessionStorage");
  assert.ok(!stored.includes("replyn.auth.role"), "Vai Business không được ghi vào sessionStorage");

  // refresh: vai Business đọc lại từ cookie qua /api/auth/session
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await visible(accountButton);
  const restored = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
  assert.equal(restored.authenticated, true);
  assert.equal(restored.identity.publicNovaId, NOVA_ID);
  assert.equal(restored.identity.role, "business");
  assert.equal(restored.identity.subjectId, undefined, "Trình duyệt không nhận subjectId");

  // menu tài khoản: danh tính đã xác minh + đăng xuất
  await accountButton.click();
  const card = page.getByRole("region", { name: "Tài khoản Nova Business" });
  await visible(card.getByText("Mộc Coffee Studio"));
  await visible(card.getByText(NOVA_ID));
  await visible(card.getByText("Nova Business đã xác minh"));
  const popover = page.locator("div.msg-in").filter({ has: card });
  assert.equal(await popover.getByText("Trần Thu Hà").count(), 0, "Menu tài khoản không hiện tên mẫu");
  await shot(page, "account-business-1440");
  assert.ok(!(await page.content()).includes(NOVA_KEY.slice(4)), "Nova Key không nằm trong giao diện");

  // đăng xuất lỗi: không giả vờ thành công
  await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 500, body: "" }));
  await card.getByRole("button", { name: "Đăng xuất Nova" }).click();
  await visible(card.getByRole("alert").filter({ hasText: "Chưa đăng xuất được" }));
  assert.equal(page.url(), `${BASE}/`, "Vẫn ở lại khi đăng xuất lỗi");
  const still = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
  assert.equal(still.authenticated, true, "Phiên vẫn còn khi đăng xuất lỗi");
  await page.unroute("**/api/auth/logout");

  // đăng xuất thành công: gọi đúng route, xóa phiên và quay về /auth/nova
  const logoutRequest = page.waitForRequest((r) => r.url() === `${BASE}/api/auth/logout` && r.method() === "POST");
  await card.getByRole("button", { name: "Đăng xuất Nova" }).click();
  await logoutRequest;
  await page.waitForURL(`${BASE}/auth/nova`);
  await page.getByRole("heading", { name: "Tiếp tục với Nova" }).waitFor();
  assert.equal((await page.context().cookies()).some((c) => c.name === "replyn_session"), false, "Đăng xuất xóa cookie");
  const after = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
  assert.deepEqual(after, { authenticated: false });
  const tabAuth = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("replyn.auth.role") || k.startsWith("replyn.auth.pending")));
  assert.deepEqual(tabAuth, [], "Đăng xuất xóa metadata đăng nhập của tab");

  // không có phiên thật: không có lệnh đăng xuất Nova
  await page.goto(`${BASE}/`);
  const demoAccount = page.getByRole("button", { name: "Hồ sơ: Trần Thu Hà" });
  await visible(demoAccount);
  await demoAccount.click();
  await visible(page.getByText("Xem với vai trò"));
  assert.equal(await page.getByRole("button", { name: "Đăng xuất Nova" }).count(), 0, "Không có phiên: không có nút đăng xuất");
  assert.equal(await page.getByText("Nova Business đã xác minh").count(), 0);
  console.log("ok  Nova ID thật → cookie HttpOnly, chống gửi lặp, refresh giữ danh tính, menu tài khoản, đăng xuất lỗi/thành công");

  /* 5. QR hết hạn → làm mới; scanned → approved; có handoff → mở đúng conversation */
  const qr = await open(`${LOGIN}?handoff=demo-handoff-01&conversation=nova-khoa`);
  const summary = qr.getByRole("region", { name: "Cuộc trò chuyện được chuyển từ Nova" });
  await visible(summary.getByText("Landing page Mộc Coffee"));
  assert.equal(await summary.getByText(/Chị trao đổi|portfolio/).count(), 0, "Không lộ nội dung tin nhắn");
  await visible(qrImage(qr));
  await demoStep(qr, "Làm mã hết hạn");
  await visible(qr.getByText("Mã đã hết hạn", { exact: true }));
  await shot(qr, "login-qr-expired-1440");
  await qr.getByRole("button", { name: "Tạo mã mới" }).click();
  await visible(qrImage(qr));
  await demoStep(qr, "Mô phỏng: điện thoại quét mã");
  await visible(qr.getByText("Đang chờ xác nhận trên điện thoại"));
  assert.equal(await qr.locator(".na-scan-line").count(), 0, "Dừng scan line khi đã quét");
  await demoStep(qr, "Mô phỏng: xác nhận trên điện thoại");
  await visible(qr.getByText("Đã xác nhận", { exact: true }));
  await qr.waitForURL(`${BASE}/`, { timeout: 8000 });
  await visible(qr.getByRole("region", { name: "Trò chuyện: Lê Minh Khoa" }));
  await visible(qr.getByText("Đã liên kết cuộc trò chuyện từ Nova."));
  await visible(qr.getByRole("button", { name: "Hồ sơ: Lê Minh Khoa" }));
  console.log("ok  QR hết hạn/làm mới, scanned → approved, handoff mở đúng cuộc trò chuyện");

  /* 6. Lỗi tạo mã → thử lại; open redirect bị chặn */
  const fail = await open(`${LOGIN}?returnTo=//evil.example`);
  await visible(qrImage(fail));
  await demoStep(fail, "Lỗi tạo mã");
  await visible(fail.getByText("Không thể tạo mã", { exact: true }));
  await fail.getByRole("button", { name: "Thử lại" }).click();
  await visible(qrImage(fail));
  await demoStep(fail, "Mô phỏng: điện thoại quét mã");
  await demoStep(fail, "Mô phỏng: xác nhận trên điện thoại");
  await fail.waitForURL(`${BASE}/`, { timeout: 8000 });
  console.log("ok  Lỗi tạo mã có thử lại; returnTo ngoài site bị bỏ qua");

  /* 7. Responsive: cả hai tab ở laptop và mobile */
  for (const [w, h] of [[1440, 900], [1280, 720], [390, 844], [360, 800]]) {
    const p = await open(`${LOGIN}?handoff=demo-handoff-01&conversation=nova-khoa`, { width: w, height: h });
    if (w < 768) await selected(p, "Nova ID"); // mobile mặc định Nova ID
    await tab(p, "Mã QR").click();
    await visible(qrImage(p));
    const box = await qrImage(p).boundingBox();
    assert.ok(box.width >= 220 && box.x >= 0 && box.x + box.width <= w, `QR đủ lớn và nằm trong màn ${w}px`);
    await shot(p, `login-qr-${w}`);
    await tab(p, "Nova ID").click();
    await visible(p.getByRole("button", { name: "Tiếp tục với Nova ID" }));
    await shot(p, `login-id-${w}`);
    if (w >= 768) {
      const hId = await heightAfter(p, "Nova ID");
      const hQr = await heightAfter(p, "Mã QR");
      assert.ok(Math.abs(hId - hQr) <= 2, `Khung không đổi kích thước khi đổi tab ở ${w}px (${hId} vs ${hQr})`);
    }
    await p.context().close();
  }
  console.log("ok  1440/1280/390/360: không tràn ngang, QR ≥ 220px; desktop đổi tab không đổi kích thước khung");

  assert.deepEqual(errors, [], "Browser console errors");
  console.log("PASS: đăng nhập Replyn bằng Nova (Nova ID qua server, QR thử nghiệm)");
} finally {
  await browser.close();
  fakeNova.close();
  server?.kill();
}
