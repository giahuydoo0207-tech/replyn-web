/**
 * Nhắc hạn tự động: Replyn tự đăng lời nhắc vào chat workspace để cả hai bên cùng thấy, không phụ thuộc ai nhớ mở tab
 * Tiến độ. Hàm thuần: nhận workspace và thời điểm hiện tại, trả các lời nhắc chưa gửi (mỗi mốc chỉ nhắc một lần).
 *
 * - Hạn bàn giao: còn 3 ngày, còn 1 ngày (hoặc hạn là hôm nay), đã quá hạn. Chỉ nhắc khi giai đoạn còn đang chờ ký quỹ
 *   hoặc chờ bên thực hiện nộp.
 * - Thời gian nghiệm thu: còn 1 ngày, đã hết. Tính từ lần nộp gần nhất.
 * Mốc gắn với hạn hoặc bản nộp hiện tại, nên đổi hạn qua đề xuất thay đổi thì nhắc lại theo hạn mới.
 */
import type { Milestone, Workspace } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const VN = 7 * 60 * 60 * 1000;

export type ReminderTone = "info" | "warning" | "danger";

export interface Reminder {
  key: string;
  milestoneId: string;
  tone: ReminderTone;
  text: string;
}

/** Ngày theo giờ Việt Nam, tính bằng số ngày kể từ 1970, để so "còn mấy ngày" theo lịch chứ không theo 24 giờ. */
const vnDay = (ms: number) => Math.floor((ms + VN) / DAY);

/** "15/10/2026" -> số ngày lịch (giờ Việt Nam). */
export function deadlineDay(deadline: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(deadline);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) / DAY);
}

const short = (d: string) => d.slice(0, 5); // "15/10/2026" -> "15/10"
const pad2 = (n: number) => String(n).padStart(2, "0");
const vnClock = (ms: number) => {
  const t = new Date(ms + VN);
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())} ${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}`;
};

/** Giai đoạn đang chờ ai: ký quỹ (bên thuê) hay nộp sản phẩm (bên thực hiện). */
function waitingFor(m: Milestone): "fund" | "deliver" | null {
  if (m.status === "awaiting_funding") return "fund";
  if (m.status === "funded_sim" || m.status === "revision_requested") return "deliver";
  return null;
}

export function dueReminders(
  ws: Workspace,
  now: number,
  names: { business: string; freelancer: string },
  sent: ReadonlySet<string> = new Set(ws.reminded ?? []),
): Reminder[] {
  const today = vnDay(now);
  const out: Reminder[] = [];
  ws.milestones.forEach((m, i) => {
    const label = `Giai đoạn ${i + 1} · ${m.title}`;

    // Hạn bàn giao.
    const wait = waitingFor(m);
    const due = deadlineDay(m.deadline);
    if (wait && due !== null) {
      const left = due - today;
      const locked = !!(ws.termsLockedAt || ws.agreement);
      const action = !locked
        ? "Đang chờ hai bên xác nhận thỏa thuận."
        : wait === "fund"
          ? `Đang chờ ${names.business} ký quỹ để bắt đầu.`
          : `Đang chờ ${names.freelancer} nộp sản phẩm.`;
      const base = `${m.id}:due:${m.deadline}`;
      // Chỉ gửi mốc gấp nhất chưa gửi; mốc nhẹ hơn bị bỏ qua thì coi như đã qua.
      const stage = left < 0 ? "over" : left <= 1 ? "d1" : left <= 3 ? "d3" : null;
      if (stage && !sent.has(`${base}:${stage}`)) {
        const text =
          stage === "over"
            ? `${label} đã quá hạn ${-left} ngày (hạn ${short(m.deadline)}). ${action}`
            : stage === "d1"
              ? `${label} ${left === 0 ? "đến hạn hôm nay" : "còn 1 ngày tới hạn"} (${short(m.deadline)}). ${action}`
              : `${label} còn ${left} ngày tới hạn (${short(m.deadline)}). ${action}`;
        out.push({ key: `${base}:${stage}`, milestoneId: m.id, tone: stage === "over" ? "danger" : stage === "d1" ? "warning" : "info", text });
      }
    }

    // Thời gian nghiệm thu, tính từ lần nộp gần nhất.
    if (m.status === "submitted" || m.status === "in_review") {
      const lastId = m.submissionIds[m.submissionIds.length - 1];
      const sub = ws.submissions.find((s) => s.id === lastId);
      if (sub) {
        const end = sub.at + m.reviewDays * DAY;
        const base = `${m.id}:review:${sub.id}`;
        const stage = now >= end ? "over" : end - now <= DAY ? "d1" : null;
        if (stage && !sent.has(`${base}:${stage}`)) {
          out.push({
            key: `${base}:${stage}`,
            milestoneId: m.id,
            tone: stage === "over" ? "danger" : "warning",
            text:
              stage === "over"
                ? `${label}: đã hết ${m.reviewDays} ngày nghiệm thu đã thỏa thuận. ${names.business} nên nghiệm thu hoặc yêu cầu sửa.`
                : `${label}: còn chưa tới 1 ngày để ${names.business} nghiệm thu bản nộp (hết lúc ${vnClock(end)}).`,
          });
        }
      }
    }
  });
  return out;
}
