import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

async function open(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle" });
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, animations: "disabled" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
}

async function openOptions(page) {
  if (await page.getByRole("region", { name: /Công cụ dự án:/ }).count()) {
    await page.getByRole("button", { name: "Quay lại cuộc trò chuyện", exact: true }).first().click();
  }
  const chat = page.getByRole("region", { name: /Trò chuyện:/ });
  await chat.getByRole("button", { name: "Tùy chọn", exact: true }).click();
  return page.getByRole("menu", { name: "Tùy chọn cuộc trò chuyện" });
}

try {
  const page = await open({ width: 1600, height: 900 });
  const rail = page.getByRole("navigation", { name: "Điều hướng chính" });
  const chatBefore = await page.getByRole("region", { name: /Trò chuyện:/ }).boundingBox();
  await page.mouse.move(30, 250);
  await page.waitForTimeout(350);
  assert.ok((await rail.boundingBox()).width > 200, "Rail expands on hover");
  assert.equal((await page.getByRole("region", { name: /Trò chuyện:/ }).boundingBox()).x, chatBefore.x, "Hover must not move chat");
  await rail.getByRole("button", { name: "Đóng thanh bên", exact: true }).click();
  await page.waitForTimeout(350);
  assert.equal(Math.round((await rail.boundingBox()).width), 64, "Close button collapses rail while pointer remains inside");
  await page.mouse.move(800, 500);
  await page.waitForTimeout(350);
  assert.equal(Math.round((await rail.boundingBox()).width), 64, "Rail collapses automatically");

  await page.getByRole("button", { name: "Menu Replyn", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Menu Replyn" });
  await drawer.waitFor();
  assert.equal(await drawer.getByText("Thỏa thuận", { exact: true }).count(), 0, "Global drawer must not duplicate project tools");
  await shot(page, "global-navigation");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /App đặt lịch Lotus Spa/ }).first().click();
  const menu = await openOptions(page);
  assert.ok(await menu.getByRole("menuitem", { name: /Xem thỏa thuận/ }).count());
  await shot(page, "project-context-menu");
  await menu.getByRole("menuitem", { name: /Theo dõi tiến độ/ }).click();
  assert.ok(await page.getByRole("region", { name: /Công cụ dự án:/ }).isVisible());
  assert.ok(await page.getByRole("region", { name: "Danh sách trò chuyện" }).isVisible(), "Chat list remains visible with project tool");
  await shot(page, "project-progress-inline");
  await page.getByRole("navigation", { name: "Các mục dự án" }).getByRole("button", { name: /Nhật ký/ }).click();
  await shot(page, "project-journal-inline");
  await page.getByRole("button", { name: "Quay lại cuộc trò chuyện", exact: true }).first().click();

  const flow = await open({ width: 1600, height: 900 });
  await flow.getByRole("button", { name: "Thêm", exact: true }).click();
  await flow.getByRole("menuitem", { name: /Đề xuất Replyn/ }).click();
  const pendingFolder = flow.getByRole("button", { name: "Xem đề xuất công việc", exact: true });
  assert.ok(await pendingFolder.isVisible(), "Binder must appear as soon as the proposal is sent");
  await pendingFolder.click();
  await flow.waitForTimeout(850);
  assert.ok(await flow.getByRole("button", { name: "Mở Replyn", exact: true }).isVisible(), "Pending binder returns to the proposal card");
  await flow.getByRole("button", { name: "Mở Replyn", exact: true }).click();
  assert.equal(await flow.getByRole("button", { name: /Landing page Mộc Coffee/ }).count(), 0, "Linked workspace must not create a second chat-list item");
  await shot(flow, "merged-workspace-mode");
  await flow.getByRole("button", { name: "Về hội thoại", exact: true }).click();
  await flow.waitForTimeout(850);
  assert.ok(await flow.getByRole("region", { name: "Trò chuyện: Lê Minh Khoa" }).isVisible(), "Workspace returns to the same conversation");
  await shot(flow, "merged-chat-mode");
  await flow.getByRole("button", { name: "Mở hồ sơ công việc", exact: true }).click();
  await flow.waitForTimeout(850);
  const proposalMenu = await openOptions(flow);
  await proposalMenu.getByRole("menuitem", { name: /Xem thỏa thuận/ }).click();
  await flow.getByRole("button", { name: /^Hai bên xác nhận/ }).click();
  await flow.getByRole("navigation", { name: "Các mục dự án" }).getByRole("button", { name: /Tiến độ/ }).click();
  await flow.getByRole("button", { name: "Ký quỹ (mô phỏng)", exact: true }).first().click();

  const switchRole = async (role) => {
    await flow.getByRole("button", { name: "Demo", exact: true }).click();
    await flow.getByRole("button", { name: new RegExp(`^${role}`) }).click();
    await flow.mouse.click(1000, 70);
  };
  await switchRole("Freelancer");
  await flow.getByRole("button", { name: "Quay lại cuộc trò chuyện", exact: true }).first().click();
  await flow.getByRole("button", { name: "Thêm", exact: true }).click();
  await flow.getByRole("menuitem", { name: /Nộp sản phẩm/ }).click();
  await flow.getByRole("button", { name: "Dùng file mẫu", exact: true }).click();
  await flow.getByRole("button", { name: /Nộp cho nghiệm thu/ }).click();
  await switchRole("Business");
  const reviewMenu = await openOptions(flow);
  await reviewMenu.getByRole("menuitem", { name: /Theo dõi tiến độ/ }).click();
  await flow.getByRole("button", { name: "Nghiệm thu", exact: true }).first().click();
  await flow.getByRole("button", { name: "Giải ngân (mô phỏng)", exact: true }).first().click();
  assert.ok(await flow.getByText("Đã giải ngân (mô phỏng)", { exact: true }).count());
  await shot(flow, "project-flow-released");
  await flow.getByRole("button", { name: "Quay lại cuộc trò chuyện", exact: true }).first().click();
  await flow.getByRole("button", { name: "Về hội thoại", exact: true }).click();
  await flow.waitForTimeout(850);
  const completedFolder = flow.getByRole("button", { name: "Mở hồ sơ công việc", exact: true });
  assert.ok(await completedFolder.isVisible(), "Binder remains available after the project is completed");
  await completedFolder.click();
  await flow.waitForTimeout(850);
  assert.ok(await flow.getByRole("button", { name: "Về hội thoại", exact: true }).isVisible(), "Completed workspace can still be reopened");

  const mobile = await open({ width: 390, height: 844 });
  await mobile.getByRole("button", { name: /App đặt lịch Lotus Spa/ }).first().click();
  const mobileMenu = await openOptions(mobile);
  await mobileMenu.getByRole("menuitem", { name: /Bàn giao sản phẩm/ }).click();
  await shot(mobile, "mobile-project-tool");
  await mobile.getByRole("button", { name: "Quay lại cuộc trò chuyện", exact: true }).first().click();
  assert.ok(await mobile.getByRole("region", { name: /Trò chuyện:/ }).isVisible());

  assert.deepEqual(errors, [], "Browser console errors");
  console.log("PASS: global rail, contextual project tools, in-chat tabs, payout flow, mobile, no console errors.");
} finally {
  await browser.close();
}
