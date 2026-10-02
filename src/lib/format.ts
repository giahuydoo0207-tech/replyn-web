// Đồng hồ demo cố định theo giờ Việt Nam (UTC+7), không phụ thuộc timezone máy để tránh lệch SSR/CSR.
const VN_OFFSET = 7 * 60 * 60 * 1000;

const vn = (ms: number) => new Date(ms + VN_OFFSET);
const pad = (n: number) => String(n).padStart(2, "0");

export const vnTime = (y: number, m: number, d: number, h: number, min: number) =>
  Date.UTC(y, m - 1, d, h, min) - VN_OFFSET;

export function hhmm(ms: number): string {
  const d = vn(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function dayKey(ms: number): string {
  const d = vn(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function ddmmyyyy(ms: number): string {
  const d = vn(ms);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/** Nhãn ngày kiểu WhatsApp: Hôm nay / Hôm qua / thứ / dd/mm/yyyy */
export function dayLabel(ms: number, now: number): string {
  const a = vn(ms);
  const b = vn(now);
  const startA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const startB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  const diff = Math.round((startB - startA) / 86_400_000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 7) return WEEKDAYS[a.getUTCDay()];
  return ddmmyyyy(ms);
}

/** Thời gian ở chat list: giờ nếu hôm nay, còn lại nhãn ngày ngắn */
export function listTime(ms: number, now: number): string {
  const label = dayLabel(ms, now);
  if (label === "Hôm nay") return hhmm(ms);
  return label.toLowerCase().startsWith("thứ") || label === "Chủ nhật"
    ? label.toLowerCase()
    : label;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

/** Hash giả lập ổn định (FNV-1a mở rộng) cho file mock. File thật dùng SHA-256 qua Web Crypto. */
export function mockHash(seed: string): string {
  let out = "";
  let h = 0x811c9dc5;
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round * 31;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
