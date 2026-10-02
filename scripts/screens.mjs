// Chụp màn hình các cảnh demo + bắt lỗi console.
// Dùng Chrome đã cài trên máy: `npm run screens` (cần `npm run dev` đang chạy).
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

async function open(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  return page;
}

const scenes = ["Nova Chat", "Đề xuất Replyn", "Workspace & milestone", "Nộp sản phẩm", "Tranh chấp", "Quyết định & bằng chứng"];

const desk = await open({ width: 1600, height: 900 });
for (const [i, title] of scenes.entries()) {
  await desk.getByRole("button", { name: "Demo", exact: true }).click();
  await desk.getByRole("button", { name: new RegExp(`^${i + 1}\\s*${title}`) }).click();
  await desk.waitForTimeout(500);
  await desk.screenshot({ path: `${OUT}/${i + 1}-${title.replace(/[^\p{L}\d]+/gu, "-").toLowerCase()}.png` });
}

// menu "+" trong Nova Chat
await desk.getByRole("button", { name: "Demo", exact: true }).click();
await desk.getByRole("button", { name: /^1\s*Nova Chat/ }).click();
await desk.getByRole("button", { name: "Thêm" }).click();
await desk.waitForTimeout(300);
await desk.screenshot({ path: `${OUT}/0-nova-menu.png` });

// Luồng thao tác thật: đề xuất → mở Replyn → cấp vốn → (freelancer) nộp → (business) nghiệm thu → giải ngân
const flow = await open({ width: 1600, height: 900 });
const switchRole = async (label) => {
  await flow.getByRole("button", { name: "Demo", exact: true }).click();
  await flow.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await flow.keyboard.press("Escape");
  await flow.mouse.click(800, 450);
};
await flow.getByRole("button", { name: "Thêm" }).click();
await flow.getByRole("menuitem", { name: /Đề xuất Replyn/ }).click();
await flow.getByRole("button", { name: /Mở Replyn/ }).click();
await flow.getByRole("button", { name: "Cấp vốn (mô phỏng)" }).first().click();
await switchRole("Freelancer");
await flow.getByRole("button", { name: "Thêm" }).click();
await flow.getByRole("menuitem", { name: /Nộp sản phẩm/ }).click();
await flow.getByRole("button", { name: "Dùng file mẫu" }).click();
await flow.getByRole("button", { name: /Nộp cho nghiệm thu/ }).click();
await switchRole("Business");
await flow.getByRole("button", { name: "Nghiệm thu", exact: true }).first().click();
await flow.getByRole("button", { name: "Giải ngân (mô phỏng)" }).first().click();
await flow.waitForTimeout(400);
const released = await flow.getByText("Đã giải ngân (mô phỏng)").count();
if (!released) errors.push("Flow: không thấy trạng thái “Đã giải ngân (mô phỏng)”");
await flow.screenshot({ path: `${OUT}/7-flow-released.png` });

const mobile = await open({ width: 390, height: 844 });
await mobile.screenshot({ path: `${OUT}/m1-list.png` });
await mobile.getByRole("button", { name: /Lê Minh Khoa/ }).first().click();
await mobile.waitForTimeout(300);
await mobile.screenshot({ path: `${OUT}/m2-chat.png` });

await browser.close();
if (errors.length) {
  console.error("Console errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`OK — ảnh lưu ở ./${OUT}`);
