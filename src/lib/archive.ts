/** Phân loại tin trong tab Lưu trữ: tệp, liên kết, ảnh và video, tin đã ghim, tin đã thu hồi. Thuần, không phụ thuộc UI. */
import type { Attachment, Message } from "./types";

export type ArchiveFilter = "all" | "files" | "links" | "media" | "pinned" | "recalled";

const VIDEO_EXT = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "heic", "svg"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export const isVideoName = (name: string) => VIDEO_EXT.includes(ext(name));

/** Ảnh hoặc video: theo loại tệp lúc gửi, hoặc theo đuôi tên tệp. */
export const isMedia = (a: Attachment | undefined) =>
  !!a && (a.kind === "image" || IMAGE_EXT.includes(ext(a.name)) || isVideoName(a.name));

/** Các URL http(s) trong văn bản, bỏ dấu câu dính ở cuối, không trùng lặp. */
export function extractLinks(text: string | undefined): string[] {
  if (!text) return [];
  const found = (text.match(URL_RE) ?? []).map((u) => u.replace(TRAILING, ""));
  return [...new Set(found)].filter((u) => {
    try {
      const p = new URL(u).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  });
}

/** Tách văn bản thành đoạn chữ và đoạn liên kết để hiển thị (không dùng HTML thô). */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0].replace(TRAILING, "");
    const start = match.index ?? 0;
    if (!extractLinks(url).length) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function matchesFilter(filter: ArchiveFilter, m: Message, a: Attachment | undefined): boolean {
  switch (filter) {
    case "all":
      return true;
    case "files":
      return m.kind !== "text" && !isMedia(a);
    case "media":
      return m.kind !== "text" && isMedia(a);
    case "links":
      return extractLinks(m.text).length > 0;
    case "pinned":
      return !!m.pinnedAt && !m.recalledAt;
    case "recalled":
      return !!m.recalledAt;
  }
}
