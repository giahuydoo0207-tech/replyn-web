// Kiểm thử màn đăng nhập Replyn bằng Nova (mock) + chụp ảnh desktop/mobile cả hai tab.
// Chạy khi `npm run dev` đang chạy: $env:BASE_URL="http://localhost:3000"; npm run test:login
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const LOGIN = `${BASE}/auth/nova`;
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

async function open(url, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
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
  await visible(page.getByText(/Nova ID có dạng NVB-XXXXX/));
  await idInput.fill("  nvb 7k29q ");
  await idInput.blur();
  assert.equal(await idInput.inputValue(), "NVB-7K29Q", "Tự trim và chuẩn hóa Nova ID");
  console.log("ok  Validation: thiếu ID, thiếu Key, sai định dạng, chuẩn hóa");

  /* 3. Hiện/ẩn Nova Key, sai key, popover trợ giúp */
  const keyInput = page.getByLabel("Nova Key", { exact: true });
  await keyInput.fill("SAI-KEY");
  assert.equal(await keyInput.getAttribute("type"), "password");
  await page.getByRole("button", { name: "Hiện Nova Key" }).click();
  assert.equal(await keyInput.getAttribute("type"), "text");
  await page.getByRole("button", { name: "Ẩn Nova Key" }).click();
  assert.equal(await keyInput.getAttribute("type"), "password");
  await keyInput.press("Enter");
  await visible(page.getByRole("button", { name: "Đang xác thực…" }), 2000);
  await visible(page.getByRole("alert").filter({ hasText: "không đúng" }));
  assert.equal(await keyInput.inputValue(), "", "Xóa Nova Key sau khi sai");
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage)).then((s) => s.includes("SAI-KEY"))), "Không lưu Nova Key");
  await page.getByRole("button", { name: "Nova ID của tôi ở đâu?" }).click();
  await visible(page.getByRole("dialog", { name: "Tìm Nova ID" }));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Tìm Nova ID" }).count(), 0, "Escape đóng trợ giúp");
  console.log("ok  Hiện/ẩn Key, lỗi sai/hết hạn, Escape đóng trợ giúp");

  /* 4. Đăng nhập Nova ID không có handoff → danh sách chat */
  await keyInput.fill("DEMO-2026");
  await keyInput.press("Enter");
  await visible(page.getByText("Đã xác minh tài khoản Nova"));
  await page.waitForURL(`${BASE}/`);
  await visible(page.getByRole("region", { name: "Danh sách trò chuyện" }));
  await visible(page.getByRole("button", { name: "Hồ sơ: Trần Thu Hà" }));
  assert.equal(await page.getByRole("region", { name: /Trò chuyện:/ }).count(), 0, "Không có handoff: chưa mở chat nào");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  assert.ok(!stored.includes("DEMO-2026"), "Nova Key không nằm trong localStorage/sessionStorage sau khi đăng nhập");
  console.log("ok  Nova ID không handoff → danh sách chat, vai Business");

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
  console.log("PASS: đăng nhập Replyn bằng Nova (mock)");
} finally {
  await browser.close();
}
