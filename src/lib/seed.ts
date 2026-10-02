import { mockHash, vnTime } from "./format";
import { reducer, wsChatId, type Action, type AppState } from "./reducer";
import type { Conversation, Message, User } from "./types";

/** Giờ demo: sáng chung kết UniHackFest */
export const DEMO_NOW = vnTime(2026, 10, 10, 9, 0);

const users: Record<string, User> = {
  "u-ha": { id: "u-ha", name: "Trần Thu Hà", short: "Thu Hà", title: "Founder · Mộc Coffee", color: "#FFB65C" },
  "u-khoa": { id: "u-khoa", name: "Lê Minh Khoa", short: "Minh Khoa", title: "UI/UX & Front-end Freelancer", color: "#5FD4E0" },
  "u-bao": { id: "u-bao", name: "Phạm Gia Bảo", short: "Gia Bảo", title: "Mobile Developer", color: "#9BE15D" },
  "u-ngoc": { id: "u-ngoc", name: "Nguyễn Bảo Ngọc", short: "Bảo Ngọc", title: "Brand Designer", color: "#FF8FB1" },
  "u-quan": { id: "u-quan", name: "Đỗ Minh Quân", short: "Minh Quân", title: "Motion Designer", color: "#B9A6FF" },
  "u-yen": { id: "u-yen", name: "Lê Hoàng Yến", short: "Hoàng Yến", title: "Studio Yến · Business", color: "#FF8A65" },
  "u-tuan": { id: "u-tuan", name: "Võ Anh Tuấn", short: "Anh Tuấn", title: "Back-end Developer", color: "#7FD1AE" },
  "u-mai": { id: "u-mai", name: "Huỳnh Mai", short: "Mai", title: "Content Writer", color: "#F5C26B" },
  replyn: { id: "replyn", name: "Replyn", short: "Replyn", title: "Hệ thống", color: "#FFD33D" },
  "nova-team": { id: "nova-team", name: "Đội ngũ Nova", short: "Đội ngũ Nova", title: "Nova Trust & Safety", color: "#FFD33D" },
};

const av = (initials: string, bg: string, fg = "#F6F2DE") => ({ initials, bg, fg });

const conversations: Record<string, Conversation> = {
  "nova-khoa": {
    id: "nova-khoa",
    kind: "nova",
    title: "Lê Minh Khoa",
    subtitle: "Nova Chat · Ứng viên “Landing page Mộc Coffee”",
    avatar: av("MK", "#123b40", "#5FD4E0"),
    memberIds: ["u-ha", "u-khoa"],
    unread: 0,
    proposal: {
      projectTitle: "Landing page Mộc Coffee",
      feeTier: "BASIC",
      milestones: [
        {
          id: "ms-1",
          title: "Thiết kế UI landing page",
          amount: 1000,
          deadline: "15/10/2026",
          criteria: [
            "Figma desktop + mobile, đủ 6 section",
            "Đúng brand guideline Mộc Coffee",
            "Tối đa 2 lượt sửa",
          ],
        },
        {
          id: "ms-2",
          title: "Code & bàn giao landing page",
          amount: 1500,
          deadline: "25/10/2026",
          criteria: [
            "Next.js, responsive mobile",
            "Lighthouse Performance ≥ 90",
            "Bàn giao source + hướng dẫn deploy",
          ],
        },
      ],
    },
  },
  "nova-quan": {
    id: "nova-quan",
    kind: "nova",
    title: "Đỗ Minh Quân",
    subtitle: "Nova Chat · Ứng viên “Video motion menu mùa thu”",
    avatar: av("MQ", "#2c2547", "#B9A6FF"),
    memberIds: ["u-ha", "u-quan"],
    unread: 1,
  },
  "nova-yen": {
    id: "nova-yen",
    kind: "nova",
    title: "Lê Hoàng Yến",
    subtitle: "Nova Chat · Studio Yến",
    avatar: av("HY", "#43231a", "#FF8A65"),
    memberIds: ["u-yen", "u-khoa"],
    unread: 2,
  },
  "group-hcm": {
    id: "group-hcm",
    kind: "group",
    title: "Nova Freelancers HCM",
    subtitle: "1.284 thành viên",
    avatar: av("NF", "#1f2a14", "#9BE15D"),
    memberIds: ["u-tuan", "u-mai", "u-ngoc", "u-bao", "u-khoa", "u-ha"],
    unread: 12,
    muted: true,
  },
  "channel-nova": {
    id: "channel-nova",
    kind: "channel",
    title: "Đội ngũ Nova",
    subtitle: "Kênh thông báo · 48.910 người theo dõi",
    avatar: av("N", "#FFD33D", "#0B0D0A"),
    memberIds: ["nova-team"],
    unread: 1,
  },
};

type Seed = [chatId: string, sender: string, at: number, text: string, replyTo?: number];

const d = (day: number, h: number, m: number) => vnTime(2026, 10, day, h, m);

// Cuộc phỏng vấn trên Nova Chat (index dùng cho replyTo)
const seedMessages: Seed[] = [
  ["nova-khoa", "u-ha", d(8, 20, 2), "Chào Khoa, chị là Hà bên Mộc Coffee. Chị xem portfolio trên Nova rồi, phần landing page cho chuỗi F&B rất ổn 👍"],
  ["nova-khoa", "u-khoa", d(8, 20, 4), "Dạ em chào chị Hà! Cảm ơn chị đã xem. Bên chị cần landing page cho dịp ra mắt menu mùa thu đúng không ạ?"],
  ["nova-khoa", "u-ha", d(8, 20, 5), "Đúng rồi. Cần có giới thiệu menu, câu chuyện thương hiệu, đặt bàn và bản đồ 3 chi nhánh."],
  ["nova-khoa", "u-ha", d(8, 20, 5), "Deadline lên sóng trước 25/10."],
  ["nova-khoa", "u-khoa", d(8, 20, 9), "Em đề xuất chia 2 giai đoạn: thiết kế UI trên Figma trước, chị duyệt xong em mới code Next.js. Như vậy sửa sẽ rẻ hơn."],
  ["nova-khoa", "u-ha", d(8, 20, 11), "Hợp lý. Báo giá giúp chị nhé?"],
  ["nova-khoa", "u-khoa", d(8, 20, 16), "Thiết kế UI: 1.000 USDC (tối đa 2 lượt sửa). Code & bàn giao: 1.500 USDC. Tổng 2.500 USDC ạ."],
  ["nova-khoa", "u-ha", d(9, 9, 30), "Chị trao đổi với team rồi, chốt chọn em nhé 🎉", 6],
  ["nova-khoa", "u-khoa", d(9, 9, 34), "Tuyệt quá, cảm ơn chị! Mình bắt đầu từ thứ Hai được không ạ?"],
  ["nova-khoa", "u-ha", d(9, 9, 36), "Ok. Lần trước chị thuê ngoài bị bỏ dở giữa chừng, lần này chị muốn mọi thứ rõ ràng từ đầu."],

  ["nova-quan", "u-quan", d(9, 16, 20), "Chào chị, em gửi thêm showreel motion 2026 ạ."],
  ["nova-quan", "u-ha", d(9, 16, 41), "Chị xem rồi, đẹp lắm. Tuần sau mình nói chuyện chi tiết nhé."],
  ["nova-quan", "u-quan", d(10, 8, 12), "Dạ vâng, em rảnh từ thứ Ba ạ. Chị cần video dài bao nhiêu giây?"],

  ["nova-yen", "u-yen", d(9, 14, 5), "Chào Khoa, chị thấy em ứng tuyển job “Website Studio Yến”."],
  ["nova-yen", "u-yen", d(10, 8, 40), "Em gửi chị case study gần nhất được không?"],

  ["group-hcm", "u-tuan", d(10, 7, 50), "Có ai dùng thử Replyn chưa? Nghe nói khóa điều khoản + milestone ngay trong chat."],
  ["group-hcm", "u-mai", d(10, 7, 52), "Mình đang dùng cho 1 dự án content. Có timeline “Bằng chứng dự án” nên đỡ cãi nhau hẳn 😅"],
  ["group-hcm", "u-ngoc", d(10, 7, 55), "Quan trọng là phí ghi rõ “mô phỏng” trong bản beta, đừng nhầm là tiền thật nha mọi người.", 16],
  ["group-hcm", "u-bao", d(10, 8, 3), "Bên mình vừa nộp milestone 2 qua Replyn, file có hash nên khách không bảo “chưa nhận được” được nữa."],
  ["group-hcm", "u-tuan", d(10, 8, 6), "Hay đấy. Tối nay ai đi offline UniHackFest không?"],

  ["channel-nova", "nova-team", d(9, 10, 0), "📣 Replyn beta: chuyển từ Nova Chat sang workspace để khóa điều khoản, chia milestone, nộp sản phẩm và theo dõi Bằng chứng dự án. Cấp vốn, giải ngân và phí đều đang được mô phỏng, Replyn không custody tiền thật."],
];

function buildMessages(): Record<string, Message[]> {
  const out: Record<string, Message[]> = {};
  const ids: string[] = [];
  seedMessages.forEach(([chatId, sender, at, text, replyTo], i) => {
    const id = `seed-${i}`;
    ids.push(id);
    (out[chatId] ??= []).push({
      id,
      chatId,
      senderId: sender,
      at,
      kind: "text",
      text,
      replyToId: replyTo !== undefined ? ids[replyTo] : undefined,
    });
  });
  return out;
}

const mockFile = (name: string, size: number) => ({ name, size, hash: mockHash(name + size) });

/** Workspace phụ cho chat list — dựng bằng chính reducer để dữ liệu luôn nhất quán */
const fillerActions: Action[] = [
  { type: "SET_CLOCK", at: d(1, 10, 0) },
  {
    type: "CREATE_WORKSPACE",
    wsId: "ws-lotus",
    title: "App đặt lịch Lotus Spa",
    businessId: "u-ha",
    freelancerId: "u-bao",
    feeTier: "ADVANCED",
    unread: 2,
    draft: [
      { id: "lt-1", title: "UX flow đặt lịch", amount: 800, deadline: "04/10/2026", criteria: ["User flow + wireframe 12 màn", "Prototype click được"] },
      { id: "lt-2", title: "App React Native MVP", amount: 2000, deadline: "12/10/2026", criteria: ["Đặt lịch, nhắc lịch, thanh toán tại quầy", "Build Android + iOS TestFlight"] },
    ],
  },
  { type: "FUND", wsId: "ws-lotus", milestoneId: "lt-1" },
  { type: "SET_CLOCK", at: d(4, 17, 0) },
  { type: "SUBMIT", wsId: "ws-lotus", milestoneId: "lt-1", file: mockFile("lotus-ux-flow-v1.fig", 8_420_112), note: "Flow đặt lịch 12 màn + prototype." },
  { type: "ACCEPT", wsId: "ws-lotus", milestoneId: "lt-1" },
  { type: "RELEASE", wsId: "ws-lotus", milestoneId: "lt-1" },
  { type: "FUND", wsId: "ws-lotus", milestoneId: "lt-2" },
  { type: "SET_CLOCK", at: d(10, 8, 20) },
  { type: "SUBMIT", wsId: "ws-lotus", milestoneId: "lt-2", file: mockFile("lotus-spa-mvp-build-1.0.3.apk", 41_903_552), note: "Bản build 1.0.3, đã có nhắc lịch qua push. Chị test giúp em nhé." },

  { type: "SET_CLOCK", at: d(3, 9, 0) },
  {
    type: "CREATE_WORKSPACE",
    wsId: "ws-tramay",
    title: "Bộ nhận diện Trà Mây",
    businessId: "u-ha",
    freelancerId: "u-ngoc",
    feeTier: "BASIC",
    draft: [
      { id: "tm-1", title: "Logo & bộ nhận diện", amount: 1200, deadline: "08/10/2026", criteria: ["3 phương án logo", "Bảng màu, font, 10 ấn phẩm"] },
    ],
  },
  { type: "FUND", wsId: "ws-tramay", milestoneId: "tm-1" },
  { type: "SET_CLOCK", at: d(8, 18, 0) },
  { type: "SUBMIT", wsId: "ws-tramay", milestoneId: "tm-1", file: mockFile("tramay-brand-guideline.pdf", 12_310_400), note: "Brand guideline bản hoàn chỉnh." },
  {
    type: "OPEN_DISPUTE",
    wsId: "ws-tramay",
    milestoneId: "tm-1",
    openedBy: "u-ha",
    reason: "Chỉ có 1 phương án logo thay vì 3 như điều khoản.",
    evidenceAttachmentIds: [],
  },
  { type: "SET_CLOCK", at: d(9, 11, 0) },
  { type: "NOVA_REVIEW", wsId: "ws-tramay", disputeId: "d-0" },
];

export function initialState(): AppState {
  let s: AppState = {
    seq: 0,
    clock: DEMO_NOW,
    role: "business",
    roleUser: { business: "u-ha", freelancer: "u-khoa" },
    users,
    conversations,
    order: [],
    messages: buildMessages(),
    workspaces: {},
    looseFiles: {},
    ui: { activeChatId: null, panelTab: "milestones", panelOpen: true, filter: "all", flashId: null },
  };
  for (const a of fillerActions) {
    // dispute id phụ thuộc seq, nên tra lại id thật trước khi dispatch
    if (a.type === "NOVA_REVIEW") {
      const dId = s.workspaces[a.wsId].disputes[0].id;
      s = reducer(s, { ...a, disputeId: dId });
    } else s = reducer(s, a);
  }
  // thêm vài tin nhắn người thật vào workspace phụ
  s = reducer(s, { type: "SEND_TEXT", chatId: wsChatId("ws-lotus"), senderId: "u-bao", text: "Chị Hà ơi, nếu ok chị bấm nghiệm thu giúp em nhé, review còn 2 ngày ạ 🙏" });
  s = reducer(s, { type: "SEND_TEXT", chatId: wsChatId("ws-tramay"), senderId: "u-ngoc", text: "Em đã gửi 2 phương án còn lại qua email từ 5/10, em sẽ upload lên đây làm bằng chứng." });

  // sắp xếp chat list theo tin mới nhất
  const lastAt = (id: string) => s.messages[id]?.at(-1)?.at ?? 0;
  const order = Object.keys(s.conversations).sort((a, b) => lastAt(b) - lastAt(a));
  return {
    ...s,
    clock: DEMO_NOW,
    order,
    conversations: {
      ...s.conversations,
      [wsChatId("ws-lotus")]: { ...s.conversations[wsChatId("ws-lotus")], unread: 2 },
      [wsChatId("ws-tramay")]: { ...s.conversations[wsChatId("ws-tramay")], unread: 1 },
    },
    ui: { ...s.ui, activeChatId: "nova-khoa" },
  };
}

/* ---------- Scene demo cho buổi chung kết ---------- */

export interface Scene {
  id: number;
  title: string;
  hint: string;
}

export const SCENES: Scene[] = [
  { id: 1, title: "Nova Chat", hint: "Phỏng vấn xong, mở menu “+” → Đề xuất Replyn" },
  { id: 2, title: "Đề xuất Replyn", hint: "Proposal card trong chat, CTA “Mở Replyn”" },
  { id: 3, title: "Workspace & milestone", hint: "Điều khoản đã khóa, M1 đã cấp vốn (mô phỏng)" },
  { id: 4, title: "Nộp sản phẩm", hint: "File card có hash, đang chờ nghiệm thu" },
  { id: 5, title: "Tranh chấp", hint: "Sửa → nộp lại → mở tranh chấp → Đội ngũ Nova review" },
  { id: 6, title: "Quyết định & bằng chứng", hint: "Chia tiền 600/400 + timeline Bằng chứng dự án" },
];

export function buildScene(n: number): AppState {
  let s = initialState();
  const run = (a: Action) => (s = reducer(s, a));
  const ws = () => Object.values(s.workspaces).find((w) => w.title === "Landing page Mộc Coffee")!;
  if (n >= 2) run({ type: "PROPOSE_REPLYN", chatId: "nova-khoa", senderId: "u-ha" });
  if (n >= 3) {
    run({ type: "SEND_TEXT", chatId: "nova-khoa", senderId: "u-khoa", text: "Em đồng ý, mình chuyển sang Replyn ạ." });
    run({ type: "OPEN_REPLYN", chatId: "nova-khoa" });
    run({ type: "FUND", wsId: ws().id, milestoneId: "ms-1" });
    run({ type: "SEND_TEXT", chatId: wsChatId(ws().id), senderId: "u-khoa", text: "Em nhận được thông báo cấp vốn (mô phỏng) rồi ạ. Em bắt đầu thiết kế luôn." });
  }
  if (n >= 4) {
    run({ type: "SEND_TEXT", chatId: wsChatId(ws().id), senderId: "u-ha", text: "Nhớ bám brand guideline mới nhé, màu nâu đất là chủ đạo." });
    run({
      type: "SUBMIT",
      wsId: ws().id,
      milestoneId: "ms-1",
      file: mockFile("moc-coffee-landing-ui-v1.fig", 6_815_744),
      note: "Bản thiết kế v1: 6 section desktop + mobile.",
    });
  }
  if (n >= 5) {
    run({ type: "REQUEST_REVISION", wsId: ws().id, milestoneId: "ms-1", note: "Thiếu bản mobile cho section Đặt bàn và Bản đồ chi nhánh." });
    run({ type: "SEND_TEXT", chatId: wsChatId(ws().id), senderId: "u-khoa", text: "Dạ em bổ sung trong hôm nay ạ." });
    run({
      type: "SUBMIT",
      wsId: ws().id,
      milestoneId: "ms-1",
      file: mockFile("moc-coffee-landing-ui-v2.fig", 7_340_032),
      note: "v2: đã thêm mobile cho Đặt bàn + Bản đồ.",
    });
    run({
      type: "OPEN_DISPUTE",
      wsId: ws().id,
      milestoneId: "ms-1",
      openedBy: "u-ha",
      reason: "Bản v2 vẫn chưa đúng brand guideline: sai font và bảng màu ở 4/6 section.",
      evidenceAttachmentIds: ws().attachments.map((a) => a.id),
    });
    run({ type: "SEND_TEXT", chatId: wsChatId(ws().id), senderId: "u-khoa", text: "Em đã làm đủ 6 section desktop + mobile theo tiêu chí. Font em dùng theo file guideline chị gửi ngày 9/10." });
    run({ type: "NOVA_REVIEW", wsId: ws().id, disputeId: ws().disputes[0].id });
  }
  if (n >= 6) {
    run({ type: "RESOLVE", wsId: ws().id, disputeId: ws().disputes[0].id, freelancerGross: 600 });
    run({ type: "SET_PANEL", tab: "evidence", open: true });
  }
  if (n >= 3) run({ type: "SELECT_CHAT", chatId: wsChatId(ws().id) });
  if (n === 5) run({ type: "SET_PANEL", tab: "dispute", open: true });
  if (n === 3 || n === 4) run({ type: "SET_PANEL", tab: "milestones", open: true });
  return s;
}
