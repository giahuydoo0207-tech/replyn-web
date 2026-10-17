import type { Role } from "../types";

/**
 * Tài khoản mẫu của bản demo. Mỗi tài khoản ngồi đúng vào một người trong dữ liệu mẫu (`id` trùng id người dùng
 * trong seed), nên đăng nhập là thấy ngay các cuộc trò chuyện và dự án của người đó.
 * Chưa có backend: mật khẩu dùng chung và được ghi công khai trên trang đăng nhập.
 */
export interface DemoAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string;
}

export const DEMO_PASSWORD = "replyn2026";

export const ACCOUNTS: DemoAccount[] = [
  { id: "u-ha", email: "ha@moccoffee.vn", name: "Trần Thu Hà", role: "business", title: "Founder · Mộc Coffee" },
  { id: "u-khoa", email: "khoa@replyn.dev", name: "Lê Minh Khoa", role: "freelancer", title: "UI/UX & Front-end Freelancer" },
  { id: "u-yen", email: "yen@studioyen.vn", name: "Lê Hoàng Yến", role: "business", title: "Studio Yến · Business" },
];

export const accountById = (id: unknown) => ACCOUNTS.find((a) => a.id === id) ?? null;

export const accountByEmail = (email: unknown) =>
  typeof email === "string" ? (ACCOUNTS.find((a) => a.email === email.trim().toLowerCase()) ?? null) : null;
