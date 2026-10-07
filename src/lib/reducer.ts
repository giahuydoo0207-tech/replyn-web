import { computePayout } from "./fees";
import { defaultTab } from "./protection";
import type { ArchiveFilter } from "./archive";
import { applyOps, currentVersion, pendingChange, totals } from "./scopeChange";
import type {
  Attachment,
  ChangeOp,
  Conversation,
  EvidenceEvent,
  FeeTier,
  Message,
  Milestone,
  MilestoneStatus,
  NovaAgreement,
  ProposalDraft,
  Role,
  User,
  Workspace,
} from "./types";

/**
 * Workspace thật từ một đề xuất Nova đã được chấp nhận, như server Replyn trả về sau khi kiểm tra quyền.
 * Không chứa mã hồ sơ nội bộ; chỉ có tên hiển thị của hai bên và vai trò của người đang xem.
 */
export interface NovaWorkspace {
  workspaceId: string;
  projectName: string;
  scope: string;
  deliverables: string[];
  revisionLimit: number | null;
  currency: string;
  totalAmount: number;
  startDate: string | null;
  deadline: string | null;
  reviewPeriodDays: number | null;
  milestones: { title: string; amount: number; deadline: string | null }[];
  notes: string;
  acceptedAt: string;
  businessName: string;
  freelancerName: string;
  viewerRole: Role;
  /** Chỉ doanh nghiệp: liên kết về cuộc trò chuyện trên Nova Business (server tính, có thể không có). */
  novaReturnUrl?: string;
}

/** Ghế của danh tính Nova thật đang đăng nhập (thay cho ghế dữ liệu mẫu). */
export const NOVA_ME = "nova-me";
export const novaWsId = (workspaceId: string) => `nova-${workspaceId}`;
export const novaSourceChatId = (workspaceId: string) => `nova-source-${workspaceId}`;

export type PanelTab = "archive" | "terms" | "milestones" | "files" | "evidence" | "dispute";
export type ListFilter = "all" | "unread" | "replyn" | "tasks" | "files" | "review" | "dispute";

export interface UiState {
  activeChatId: string | null;
  panelTab: PanelTab;
  panelOpen: boolean;
  filter: ListFilter;
  flashId: string | null; // message/evidence vừa được nhảy tới
  /** Bộ lọc đang chọn trong tab Lưu trữ; thanh ghim mở thẳng mục "Đã ghim". */
  archiveFilter?: ArchiveFilter;
}

export interface AppState {
  seq: number;
  clock: number;
  role: Role;
  roleUser: Record<Role, string>;
  users: Record<string, User>;
  conversations: Record<string, Conversation>;
  order: string[]; // thứ tự chat list (mới nhất lên đầu khi có tin)
  messages: Record<string, Message[]>;
  workspaces: Record<string, Workspace>;
  looseFiles: Record<string, Attachment>; // tệp gửi ngoài workspace (Nova Chat)
  ui: UiState;
}

export interface NewFile {
  name: string;
  size: number;
  hash: string;
  kind?: "file" | "image";
}

export type Action =
  | { type: "SET_CLOCK"; at: number }
  | { type: "SET_ROLE"; role: Role }
  | { type: "SELECT_CHAT"; chatId: string | null }
  | { type: "SET_PANEL"; tab?: PanelTab; open?: boolean; archiveFilter?: ArchiveFilter }
  | { type: "SET_FILTER"; filter: ListFilter }
  | { type: "TOGGLE_PIN"; chatId: string }
  | { type: "TOGGLE_MUTE"; chatId: string }
  | { type: "MARK_UNREAD"; chatId: string }
  | { type: "RECALL_MESSAGE"; chatId: string; messageId: string }
  | { type: "TOGGLE_MESSAGE_PIN"; chatId: string; messageId: string }
  | { type: "PROPOSE_SCOPE_CHANGE"; wsId: string; reason: string; ops: ChangeOp[] }
  | { type: "RESPOND_SCOPE_CHANGE"; wsId: string; changeId: string; accept: boolean; note?: string }
  | { type: "WITHDRAW_SCOPE_CHANGE"; wsId: string; changeId: string }
  | { type: "FLASH"; id: string | null }
  | { type: "SEND_TEXT"; chatId: string; text: string; senderId?: string; replyToId?: string }
  | { type: "SEND_FILE"; chatId: string; file: NewFile; senderId?: string; text?: string }
  | {
      type: "CREATE_WORKSPACE";
      wsId: string;
      title: string;
      businessId: string;
      freelancerId: string;
      feeTier: FeeTier;
      draft: ProposalDraft["milestones"];
      /** Nova Chat (chỉ xem) mà đề xuất đã được chấp nhận trong đó */
      fromNova?: string;
      unread?: number;
      reviewDays?: number;
      revisionLimit?: number;
      agreement?: NovaAgreement;
    }
  | { type: "LOAD_NOVA_WORKSPACES"; viewer: { role: Role; name: string }; workspaces: NovaWorkspace[] }
  | { type: "LOCK_TERMS"; wsId: string }
  | { type: "FUND"; wsId: string; milestoneId: string }
  | { type: "SUBMIT"; wsId: string; milestoneId: string; file: NewFile; note: string }
  | { type: "REQUEST_REVISION"; wsId: string; milestoneId: string; note: string }
  | { type: "ACCEPT"; wsId: string; milestoneId: string }
  | { type: "RELEASE"; wsId: string; milestoneId: string }
  | {
      type: "OPEN_DISPUTE";
      wsId: string;
      milestoneId: string;
      reason: string;
      openedBy: string;
      evidenceAttachmentIds: string[];
    }
  | { type: "NOVA_REVIEW"; wsId: string; disputeId: string }
  | { type: "RESOLVE"; wsId: string; disputeId: string; freelancerGross: number }
  | { type: "SET_FEE_TIER"; wsId: string; tier: FeeTier }
  | { type: "REPLACE"; state: AppState };

export const SYSTEM_ID = "replyn";
export const NOVA_TEAM_ID = "nova-team";

export const wsChatId = (wsId: string) => `chat-${wsId}`;
export const me = (s: AppState) => s.roleUser[s.role];

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  awaiting_funding: "Chờ cấp vốn",
  funded_sim: "Đã ký quỹ (mô phỏng)",
  submitted: "Đã nộp sản phẩm",
  in_review: "Đang chờ nghiệm thu",
  revision_requested: "Yêu cầu sửa",
  ready_to_release: "Đủ điều kiện giải ngân",
  disputed: "Đang được hỗ trợ",
  released_sim: "Đã giải ngân (mô phỏng)",
  refunded: "Quyết định hoàn tiền (mô phỏng)",
  split: "Quyết định chia tiền (mô phỏng)",
};

const STEP = 4 * 60 * 1000; // mỗi hành động demo cách nhau ~4 phút

/* ---------- helpers bất biến ---------- */

function tick(s: AppState): AppState {
  return { ...s, clock: s.clock + STEP };
}

function nextId(s: AppState, prefix: string): [AppState, string] {
  const seq = s.seq + 1;
  return [{ ...s, seq }, `${prefix}-${seq}`];
}

function pushMessage(
  s: AppState,
  m: Omit<Message, "id" | "at"> & { at?: number },
): [AppState, Message] {
  const [s1, id] = nextId(s, "m");
  const msg: Message = { ...m, id, at: m.at ?? s1.clock };
  const list = s1.messages[m.chatId] ?? [];
  const isMine = msg.senderId === me(s1);
  const conv = s1.conversations[m.chatId];
  const viewing = s1.ui.activeChatId === m.chatId;
  return [
    {
      ...s1,
      messages: { ...s1.messages, [m.chatId]: [...list, msg] },
      order: [m.chatId, ...s1.order.filter((c) => c !== m.chatId)],
      conversations: conv
        ? {
            ...s1.conversations,
            [m.chatId]: {
              ...conv,
              unread: isMine || viewing ? conv.unread : conv.unread + 1,
            },
          }
        : s1.conversations,
    },
    msg,
  ];
}

function updateWs(s: AppState, wsId: string, fn: (w: Workspace) => Workspace): AppState {
  const w = s.workspaces[wsId];
  if (!w) return s;
  return { ...s, workspaces: { ...s.workspaces, [wsId]: fn(w) } };
}

function patchMilestone(
  s: AppState,
  wsId: string,
  milestoneId: string,
  fn: (m: Milestone) => Milestone,
): AppState {
  return updateWs(s, wsId, (w) => ({
    ...w,
    milestones: w.milestones.map((m) => (m.id === milestoneId ? fn(m) : m)),
  }));
}

function addEvidence(
  s: AppState,
  wsId: string,
  e: Omit<EvidenceEvent, "id" | "at">,
): [AppState, string] {
  const [s1, id] = nextId(s, "ev");
  const ev: EvidenceEvent = { ...e, id, at: s1.clock };
  return [updateWs(s1, wsId, (w) => ({ ...w, evidence: [...w.evidence, ev] })), id];
}

function addAttachment(
  s: AppState,
  wsId: string | undefined,
  file: NewFile,
  uploadedBy: string,
  extra: Partial<Attachment> = {},
): [AppState, Attachment] {
  const [s1, id] = nextId(s, "f");
  const a: Attachment = {
    id,
    name: file.name,
    size: file.size,
    hash: file.hash,
    kind: file.kind ?? "file",
    uploadedBy,
    at: s1.clock,
    ...extra,
  };
  const s2 = wsId
    ? updateWs(s1, wsId, (w) => ({ ...w, attachments: [...w.attachments, a] }))
    : { ...s1, looseFiles: { ...s1.looseFiles, [id]: a } };
  return [s2, a];
}

function milestoneOf(s: AppState, wsId: string, id: string) {
  return s.workspaces[wsId]?.milestones.find((m) => m.id === id);
}

function milestoneIndex(s: AppState, wsId: string, id: string) {
  return (s.workspaces[wsId]?.milestones.findIndex((m) => m.id === id) ?? 0) + 1;
}

/* ---------- reducer ---------- */

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "REPLACE":
      return action.state;

    case "SET_CLOCK":
      return { ...state, clock: action.at };

    case "SET_ROLE": {
      const s = { ...state, role: action.role };
      // nếu chat đang mở không thuộc về người dùng mới thì quay về chat đầu tiên phù hợp
      const active = s.ui.activeChatId;
      if (active && !visibleTo(s, active)) {
        const first = s.order.find((c) => visibleTo(s, c)) ?? null;
        return { ...s, ui: { ...s.ui, activeChatId: first } };
      }
      return s;
    }

    case "SELECT_CHAT": {
      const id = action.chatId;
      const conv = id ? state.conversations[id] : undefined;
      return {
        ...state,
        ui: {
          ...state.ui,
          activeChatId: id,
          panelOpen: false,
          // mở workspace: panel tự chọn tab theo ngữ cảnh (tranh chấp mở → Tranh chấp, còn lại → Milestones)
          panelTab:
            conv?.workspaceId && conv.id !== state.ui.activeChatId
              ? defaultTab(state.workspaces[conv.workspaceId])
              : state.ui.panelTab,
        },
        conversations: conv
          ? { ...state.conversations, [conv.id]: { ...conv, unread: 0 } }
          : state.conversations,
      };
    }

    case "SET_PANEL":
      return {
        ...state,
        ui: {
          ...state.ui,
          panelTab: action.tab ?? state.ui.panelTab,
          panelOpen: action.open ?? state.ui.panelOpen,
          archiveFilter: action.archiveFilter ?? state.ui.archiveFilter,
        },
      };

    case "SET_FILTER":
      return { ...state, ui: { ...state.ui, filter: action.filter } };

    case "TOGGLE_PIN": {
      const conv = state.conversations[action.chatId];
      if (!conv) return state;
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [conv.id]: { ...conv, pinned: !conv.pinned },
        },
      };
    }

    case "MARK_UNREAD": {
      const conv = state.conversations[action.chatId];
      if (!conv) return state;
      return { ...state, conversations: { ...state.conversations, [conv.id]: { ...conv, unread: Math.max(1, conv.unread) } } };
    }

    case "RECALL_MESSAGE": {
      // Chỉ người gửi thu hồi được tin văn bản/tệp của chính mình.
      // Workspace: giữ nội dung trong Lưu trữ để hai bên đối chiếu.
      // Nhóm: kiểu Telegram, xóa hẳn tin khỏi cuộc trò chuyện, không để lại dấu vết.
      const list = state.messages[action.chatId];
      const target = list?.find((m) => m.id === action.messageId);
      if (!target || !canRecall(state, target)) return state;
      if (!keepsRecalled(state, target)) {
        return { ...state, messages: { ...state.messages, [action.chatId]: list.filter((m) => m.id !== action.messageId) } };
      }
      const s = tick(state);
      return {
        ...s,
        messages: {
          ...s.messages,
          // tin đã thu hồi cũng rời khỏi danh sách ghim
          [action.chatId]: list.map((m) =>
            m.id === action.messageId ? { ...m, recalledAt: s.clock, pinnedAt: undefined, pinnedBy: undefined } : m,
          ),
        },
      };
    }

    case "TOGGLE_MESSAGE_PIN": {
      // Ghim thường: cả hai bên đều ghim/bỏ ghim được, không đổi nội dung tin và không ảnh hưởng niêm phong.
      const list = state.messages[action.chatId];
      const target = list?.find((m) => m.id === action.messageId);
      if (!target || !canPin(state, target)) return state;
      const s = tick(state);
      return {
        ...s,
        messages: {
          ...s.messages,
          [action.chatId]: list.map((m) =>
            m.id !== action.messageId
              ? m
              : m.pinnedAt
                ? { ...m, pinnedAt: undefined, pinnedBy: undefined }
                : { ...m, pinnedAt: s.clock, pinnedBy: me(s) },
          ),
        },
      };
    }

    case "TOGGLE_MUTE": {
      const conv = state.conversations[action.chatId];
      if (!conv) return state;
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [conv.id]: { ...conv, muted: !conv.muted },
        },
      };
    }

    case "FLASH":
      return { ...state, ui: { ...state.ui, flashId: action.id } };

    case "SEND_TEXT": {
      const s = tick(state);
      const [s1] = pushMessage(s, {
        chatId: action.chatId,
        senderId: action.senderId ?? me(s),
        kind: "text",
        text: action.text,
        replyToId: action.replyToId,
      });
      return s1;
    }

    case "SEND_FILE": {
      const s = tick(state);
      const sender = action.senderId ?? me(s);
      const wsId = s.conversations[action.chatId]?.workspaceId;
      const [s1, att] = addAttachment(s, wsId, action.file, sender);
      const [s2] = pushMessage(s1, {
        chatId: action.chatId,
        senderId: sender,
        kind: "file",
        text: action.text,
        refs: { workspaceId: wsId, attachmentId: att.id },
      });
      return s2;
    }

    case "CREATE_WORKSPACE": {
      // Workspace thật từ Nova: mọi mốc mở đầu dùng đúng thời điểm chấp nhận đề xuất, không dùng đồng hồ demo.
      const fromAcceptedNova = !!action.agreement;
      const s = fromAcceptedNova ? { ...state, clock: action.agreement!.acceptedAt } : tick(state);
      const chatId = wsChatId(action.wsId);
      const business = s.users[action.businessId];
      const freelancer = s.users[action.freelancerId];
      const milestones: Milestone[] = action.draft.map((d) => ({
        ...d,
        status: "awaiting_funding",
        reviewDays: action.reviewDays ?? 3,
        revisionLimit: action.revisionLimit ?? 2,
        revisionsUsed: 0,
        submissionIds: [],
      }));
      const ws: Workspace = {
        agreement: action.agreement,
        id: action.wsId,
        title: action.title,
        businessId: action.businessId,
        freelancerId: action.freelancerId,
        feeTier: action.feeTier,
        // Đề xuất đã được freelancer chấp nhận trên Nova: thỏa thuận đã khóa với cả hai bên từ lúc đó.
        termsLockedAt: fromAcceptedNova ? s.clock : null,
        milestones,
        attachments: [],
        submissions: [],
        disputes: [],
        evidence: [],
      };
      const conv: Conversation = {
        id: chatId,
        kind: "replyn",
        title: action.title,
        subtitle: `${business.name} · ${freelancer.name}`,
        avatar: { initials: initials(action.title), bg: "#233138", fg: "#e9edef" },
        memberIds: [action.businessId, action.freelancerId],
        unread: action.unread ?? 0,
        workspaceId: action.wsId,
        sourceNovaChatId: action.fromNova,
      };
      const novaChat = action.fromNova ? s.conversations[action.fromNova] : undefined;
      let s1: AppState = {
        ...s,
        workspaces: { ...s.workspaces, [action.wsId]: ws },
        conversations: {
          ...s.conversations,
          [chatId]: conv,
          ...(novaChat ? { [novaChat.id]: { ...novaChat, linkedWorkspaceChatId: chatId } } : {}),
        },
        messages: { ...s.messages, [chatId]: [] },
      };
      [s1] = pushMessage(s1, {
        chatId,
        senderId: SYSTEM_ID,
        kind: "system",
        text: action.agreement || action.fromNova
          ? "Workspace Replyn được mở từ đề xuất đã được chấp nhận trên Nova"
          : "Workspace Replyn được tạo",
      });
      let s3 = s1;
      [s3] = addEvidence(s3, action.wsId, {
        type: "workspace_created",
        actorId: SYSTEM_ID,
        title: "Workspace được tạo",
        description: fromAcceptedNova
          ? `Từ đề xuất đã được chấp nhận trên Nova · ${milestones.length} giai đoạn`
          : action.fromNova
            ? `Từ đề xuất đã được chấp nhận trên Nova · ${milestones.length} giai đoạn, chờ hai bên xác nhận thỏa thuận`
            : `${milestones.length} giai đoạn, chờ hai bên xác nhận thỏa thuận`,
        messageId: s3.messages[chatId][0].id,
      });
      if (fromAcceptedNova) {
        const lockText = `Thỏa thuận đã khóa khi ${freelancer.name} chấp nhận đề xuất trên Nova`;
        let lockMsg: Message;
        [s3, lockMsg] = pushMessage(s3, {
          chatId,
          senderId: SYSTEM_ID,
          kind: "system",
          text: lockText,
          link: "terms",
          refs: { workspaceId: action.wsId },
        });
        const total = milestones.reduce((a, m) => a + m.amount, 0);
        [s3] = addEvidence(s3, action.wsId, {
          type: "terms_locked",
          actorId: SYSTEM_ID,
          title: "Thỏa thuận đã khóa trên Nova",
          description: `${lockText} · ${milestones.length} giai đoạn · tổng ${total.toLocaleString("en-US")} USDC (mô phỏng). Không thể sửa đơn phương.`,
          messageId: lockMsg.id,
        });
      }
      for (const [i, m] of milestones.entries()) {
        [s3] = pushMessage(s3, {
          chatId,
          senderId: SYSTEM_ID,
          kind: "milestone",
          link: "milestones",
          text: `Giai đoạn ${i + 1} · ${m.title} đã được tạo`,
          refs: { workspaceId: action.wsId, milestoneId: m.id },
        });
      }
      return s3;
    }

    case "LOAD_NOVA_WORKSPACES": {
      if (!action.workspaces.length) return state;
      const role = action.viewer.role;
      const peerTitle = role === "business" ? "Freelancer · Nova" : "Doanh nghiệp · Nova";
      // Danh tính thật ngồi vào ghế riêng, không mượn ghế dữ liệu mẫu (u-ha / u-khoa).
      let s: AppState = {
        ...state,
        role,
        roleUser: { ...state.roleUser, [role]: NOVA_ME },
        users: {
          ...state.users,
          [NOVA_ME]: { id: NOVA_ME, name: action.viewer.name, short: shortName(action.viewer.name), title: role === "business" ? "Doanh nghiệp · Nova" : "Freelancer · Nova", color: "#FFD33D" },
        },
      };
      const added: { chatId: string; at: number }[] = [];
      for (const w of action.workspaces) {
        const wsId = novaWsId(w.workspaceId);
        // Đã có trong tab này: giữ tiến độ mô phỏng, không dựng lại.
        if (s.workspaces[wsId]) continue;
        const peerId = `nova-peer-${w.workspaceId}`;
        const peerName = role === "business" ? w.freelancerName : w.businessName;
        s = { ...s, users: { ...s.users, [peerId]: { id: peerId, name: peerName, short: shortName(peerName), title: peerTitle, color: "#5FD4E0" } } };
        const acceptedAt = Date.parse(w.acceptedAt);
        const sourceChatId = novaSourceChatId(w.workspaceId);
        const memberIds = role === "business" ? [NOVA_ME, peerId] : [peerId, NOVA_ME];
        s = {
          ...s,
          conversations: {
            ...s.conversations,
            [sourceChatId]: {
              id: sourceChatId,
              kind: "nova",
              title: peerName,
              subtitle: `Nova Chat · ${w.projectName}`,
              avatar: { initials: initials(peerName), bg: "#123b40", fg: "#5FD4E0" },
              memberIds,
              unread: 0,
            },
          },
          messages: {
            ...s.messages,
            [sourceChatId]: [{
              id: `nova-history-${w.workspaceId}`,
              chatId: sourceChatId,
              senderId: SYSTEM_ID,
              at: Number.isFinite(acceptedAt) ? acceptedAt : s.clock,
              kind: "system",
              text: "Lịch sử trò chuyện đầy đủ vẫn nằm trên Nova. Replyn chỉ hiển thị thỏa thuận đã được chấp nhận và workspace dự án.",
            }],
          },
        };
        s = reducer(
          { ...s, clock: Number.isFinite(acceptedAt) ? acceptedAt : s.clock },
          {
            type: "CREATE_WORKSPACE",
            wsId,
            title: w.projectName,
            businessId: role === "business" ? NOVA_ME : peerId,
            freelancerId: role === "freelancer" ? NOVA_ME : peerId,
            feeTier: "BASIC",
            reviewDays: w.reviewPeriodDays ?? undefined,
            revisionLimit: w.revisionLimit ?? undefined,
            fromNova: sourceChatId,
            draft: w.milestones.map((m, i) => ({
              id: `${wsId}-m${i + 1}`,
              title: m.title,
              amount: m.amount,
              deadline: isoToDdmmyyyy(m.deadline),
              criteria: [],
            })),
            agreement: {
              novaWorkspaceId: w.workspaceId,
              scope: w.scope,
              deliverables: w.deliverables,
              notes: w.notes,
              totalAmount: w.totalAmount,
              currency: w.currency,
              startDate: w.startDate,
              deadline: w.deadline,
              acceptedAt: Number.isFinite(acceptedAt) ? acceptedAt : s.clock,
              ...(w.novaReturnUrl ? { novaReturnUrl: w.novaReturnUrl } : {}),
            },
          },
        );
        added.push({ chatId: sourceChatId, at: Number.isFinite(acceptedAt) ? acceptedAt : 0 });
      }
      // Mỗi workspace thật có đúng một mục ở chat list: hội thoại Nova (chỉ xem) đã dẫn tới nó; mục workspace
      // (có sourceNovaChatId) được ChatList gộp vào mục này. Mới chấp nhận gần nhất lên đầu.
      const newIds = added.sort((a, b) => b.at - a.at).map((x) => x.chatId);
      return {
        ...s,
        order: [...newIds, ...s.order.filter((id) => !newIds.includes(id))],
        clock: Math.max(state.clock, s.clock),
      };
    }

    case "PROPOSE_SCOPE_CHANGE": {
      // Một bên của workspace đề xuất; thỏa thuận phải đã chốt, chưa có đề xuất nào đang chờ, và đề xuất phải hợp lệ.
      const w = state.workspaces[action.wsId];
      const by = me(state);
      const reason = action.reason.trim();
      if (!w || !(w.termsLockedAt || w.agreement) || pendingChange(w) || !reason || action.ops.length === 0) return state;
      if (by !== w.businessId && by !== w.freelancerId) return state;
      if (!applyOps(w.milestones, action.ops, (i) => `check-${i}`)) return state;
      let s = tick(state);
      const [s0, changeId] = nextId(s, "chg");
      const [s1, msg] = pushMessage(s0, {
        chatId: wsChatId(w.id),
        senderId: by,
        kind: "change",
        text: reason,
        link: "terms",
        refs: { workspaceId: w.id, changeId },
      });
      s = updateWs(s1, w.id, (x) => ({
        ...x,
        changes: [
          ...(x.changes ?? []),
          {
            id: changeId,
            fromVersion: currentVersion(x),
            proposedBy: by,
            at: s1.clock,
            reason,
            ops: action.ops,
            totalBefore: totals(x.milestones, []).before,
            status: "pending",
            messageId: msg.id,
          },
        ],
      }));
      return s;
    }

    case "RESPOND_SCOPE_CHANGE": {
      // Chỉ bên còn lại trả lời; đồng ý thì áp dụng ngay và lên phiên bản mới, đề xuất không còn hợp lệ thì bỏ qua.
      const w = state.workspaces[action.wsId];
      const c = w?.changes?.find((x) => x.id === action.changeId);
      const by = me(state);
      if (!w || !c || c.status !== "pending" || by === c.proposedBy) return state;
      if (by !== w.businessId && by !== w.freelancerId) return state;
      let s = tick(state);
      let applied: ReturnType<typeof applyOps> = null;
      if (action.accept) {
        const [s0, base] = nextId(s, "ms");
        s = s0;
        applied = applyOps(w.milestones, c.ops, (i) => `${base}-${i + 1}`);
        if (!applied) return state;
      }
      const version = currentVersion(w) + (action.accept ? 1 : 0);
      const note = action.note?.trim() || undefined;
      s = updateWs(s, w.id, (x) => ({
        ...x,
        ...(applied ? { milestones: applied, version } : {}),
        changes: (x.changes ?? []).map((y) =>
          y.id === c.id
            ? { ...y, status: action.accept ? "accepted" : "declined", respondedBy: by, respondedAt: s.clock, responseNote: note }
            : y,
        ),
      }));
      const who = s.users[by]?.short ?? "Bên kia";
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "system",
        text: action.accept
          ? `${who} đã đồng ý thay đổi · Thỏa thuận lên phiên bản ${version}`
          : `${who} đã từ chối đề xuất thay đổi${note ? `: “${note}”` : ""}`,
        link: "terms",
        refs: { workspaceId: w.id, changeId: c.id },
      });
      if (!action.accept) return s1;
      const t = totals(w.milestones, c.ops); // tính trên danh sách trước khi áp dụng
      const [s2] = addEvidence(s1, w.id, {
        type: "scope_changed",
        actorId: by,
        title: `Thỏa thuận lên phiên bản ${version}`,
        description: `${s1.users[c.proposedBy]?.short ?? "Một bên"} đề xuất, ${who} đồng ý: “${c.reason}”. Tổng ${t.before.toLocaleString("en-US")} → ${t.after.toLocaleString("en-US")} USDC.`,
        messageId: msg.id,
      });
      return s2;
    }

    case "WITHDRAW_SCOPE_CHANGE": {
      const w = state.workspaces[action.wsId];
      const c = w?.changes?.find((x) => x.id === action.changeId);
      const by = me(state);
      if (!w || !c || c.status !== "pending" || by !== c.proposedBy) return state;
      let s = tick(state);
      s = updateWs(s, w.id, (x) => ({
        ...x,
        changes: (x.changes ?? []).map((y) => (y.id === c.id ? { ...y, status: "withdrawn", respondedBy: by, respondedAt: s.clock } : y)),
      }));
      const [s1] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "system",
        text: `${s.users[by]?.short ?? "Người đề xuất"} đã rút lại đề xuất thay đổi`,
        link: "terms",
        refs: { workspaceId: w.id, changeId: c.id },
      });
      return s1;
    }

    case "LOCK_TERMS": {
      const w = state.workspaces[action.wsId];
      if (!w || w.termsLockedAt) return state;
      let s = tick(state);
      s = updateWs(s, w.id, (x) => ({ ...x, termsLockedAt: s.clock }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "system",
        text: "Thỏa thuận đã xác nhận",
        link: "terms",
        refs: { workspaceId: w.id },
      });
      const total = w.milestones.reduce((a, m) => a + m.amount, 0);
      const [s2] = addEvidence(s1, w.id, {
        type: "terms_locked",
        actorId: SYSTEM_ID,
        title: "Thỏa thuận đã xác nhận",
        description: `${w.milestones.length} milestone · tổng ${total.toLocaleString("en-US")} USDC · ${
          w.feeTier === "BASIC" ? "BASIC 7%" : "ADVANCED 10%"
        } (mô phỏng). Hai bên đã xác nhận, không thể sửa đơn phương.`,
        messageId: msg.id,
      });
      return s2;
    }

    case "FUND": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || m.status !== "awaiting_funding" || !w.termsLockedAt) return state;
      let s = tick(state);
      s = patchMilestone(s, w.id, m.id, (x) => ({ ...x, status: "funded_sim" }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "payment",
        text: "funded",
        link: "milestones",
        refs: { workspaceId: w.id, milestoneId: m.id },
      });
      const [s2] = addEvidence(s1, w.id, {
        type: "funded",
        actorId: w.businessId,
        title: "Business đã kích hoạt ký quỹ mô phỏng",
        description: `Giai đoạn ${milestoneIndex(s1, w.id, m.id)} · ${m.amount.toLocaleString("en-US")} USDC · Đã ký quỹ (mô phỏng)`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return s2;
    }

    case "SUBMIT": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || !["funded_sim", "revision_requested"].includes(m.status)) return state;
      let s = tick(state);
      const version = m.submissionIds.length + 1;
      const [s1, att] = addAttachment(s, w.id, action.file, w.freelancerId, {
        version,
        milestoneId: m.id,
      });
      const [s2, subId] = nextId(s1, "sub");
      const [s3, msg] = pushMessage(s2, {
        chatId: wsChatId(w.id),
        senderId: w.freelancerId,
        kind: "submission",
        text: action.note,
        link: "files",
        refs: { workspaceId: w.id, milestoneId: m.id, submissionId: subId, attachmentId: att.id },
      });
      s = updateWs(s3, w.id, (x) => ({
        ...x,
        submissions: [
          ...x.submissions,
          { id: subId, milestoneId: m.id, version, attachmentId: att.id, note: action.note, at: s3.clock, messageId: msg.id },
        ],
      }));
      s = patchMilestone(s, w.id, m.id, (x) => ({
        ...x,
        status: "in_review",
        submissionIds: [...x.submissionIds, subId],
      }));
      const [s4] = addEvidence(s, w.id, {
        type: version === 1 ? "submitted" : "resubmitted",
        actorId: w.freelancerId,
        title: version === 1 ? "Freelancer đã nộp sản phẩm" : `Freelancer nộp lại (v${version})`,
        description: action.note,
        milestoneId: m.id,
        messageId: msg.id,
        attachmentId: att.id,
      });
      return s4;
    }

    case "REQUEST_REVISION": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || m.status !== "in_review") return state;
      const lastSub = w.submissions.find((x) => x.id === m.submissionIds.at(-1));
      let s = tick(state);
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: w.businessId,
        kind: "text",
        text: action.note,
        replyToId: lastSub?.messageId,
        refs: { workspaceId: w.id, milestoneId: m.id, submissionId: lastSub?.id },
      });
      s = patchMilestone(s1, w.id, m.id, (x) => ({
        ...x,
        status: "revision_requested",
        revisionsUsed: x.revisionsUsed + 1,
      }));
      const [s2] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "system",
        text: `${s.users[w.businessId].short} đã yêu cầu sửa giai đoạn ${milestoneIndex(s, w.id, m.id)} · lượt ${m.revisionsUsed + 1}/${m.revisionLimit}`,
        link: "milestones",
        refs: { workspaceId: w.id, milestoneId: m.id },
      });
      const [s3] = addEvidence(s2, w.id, {
        type: "revision",
        actorId: w.businessId,
        title: "Business yêu cầu sửa",
        description: `“${action.note}”`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return s3;
    }

    case "ACCEPT": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || m.status !== "in_review") return state;
      let s = tick(state);
      s = patchMilestone(s, w.id, m.id, (x) => ({ ...x, status: "ready_to_release" }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "system",
        text: `${s.users[w.businessId].short} đã nghiệm thu giai đoạn ${milestoneIndex(s, w.id, m.id)} · Đủ điều kiện giải ngân`,
        link: "milestones",
        refs: { workspaceId: w.id, milestoneId: m.id },
      });
      const [s2] = addEvidence(s1, w.id, {
        type: "accepted",
        actorId: w.businessId,
        title: "Business đã nghiệm thu",
        description: `Giai đoạn ${milestoneIndex(s1, w.id, m.id)} đạt tiêu chí · Đủ điều kiện giải ngân`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return s2;
    }

    case "RELEASE": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || m.status !== "ready_to_release") return state;
      let s = tick(state);
      const payout = computePayout(m.amount, m.amount, w.feeTier);
      s = patchMilestone(s, w.id, m.id, (x) => ({ ...x, status: "released_sim", payout }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: SYSTEM_ID,
        kind: "payment",
        text: "released",
        link: "milestones",
        refs: { workspaceId: w.id, milestoneId: m.id },
      });
      const [s2] = addEvidence(s1, w.id, {
        type: "released",
        actorId: w.businessId,
        title: "Đã kích hoạt giải ngân mô phỏng",
        description: `Freelancer nhận dự kiến ${payout.freelancerNet} USDC · phí ${payout.fee} USDC (mô phỏng)`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return s2;
    }

    case "OPEN_DISPUTE": {
      const w = state.workspaces[action.wsId];
      const m = milestoneOf(state, action.wsId, action.milestoneId);
      if (!w || !m || !["in_review", "revision_requested", "funded_sim"].includes(m.status)) return state;
      let s = tick(state);
      const [s0, dId] = nextId(s, "d");
      const [s1, msg] = pushMessage(s0, {
        chatId: wsChatId(w.id),
        senderId: action.openedBy,
        kind: "dispute",
        text: action.reason,
        link: "dispute",
        refs: { workspaceId: w.id, milestoneId: m.id, disputeId: dId },
      });
      s = updateWs(s1, w.id, (x) => ({
        ...x,
        disputes: [
          ...x.disputes,
          {
            id: dId,
            milestoneId: m.id,
            openedBy: action.openedBy,
            reason: action.reason,
            at: s1.clock,
            status: "open",
            evidenceAttachmentIds: action.evidenceAttachmentIds,
            messageId: msg.id,
          },
        ],
      }));
      s = patchMilestone(s, w.id, m.id, (x) => ({ ...x, status: "disputed" }));
      const opener = s.users[action.openedBy];
      const [s2] = addEvidence(s, w.id, {
        type: "dispute_opened",
        actorId: action.openedBy,
        title: "Yêu cầu hỗ trợ",
        description: `${opener.short} (${action.openedBy === w.businessId ? "Business" : "Freelancer"}): “${action.reason}”`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return { ...s2, ui: { ...s2.ui, panelTab: "dispute", panelOpen: true } };
    }

    case "NOVA_REVIEW": {
      const w = state.workspaces[action.wsId];
      const d = w?.disputes.find((x) => x.id === action.disputeId);
      if (!w || !d || d.status !== "open") return state;
      let s = tick(state);
      s = updateWs(s, w.id, (x) => ({
        ...x,
        disputes: x.disputes.map((y) => (y.id === d.id ? { ...y, status: "reviewing" } : y)),
      }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: NOVA_TEAM_ID,
        kind: "system",
        text: `Đội ngũ Nova đang đối chiếu thông tin cho giai đoạn ${milestoneIndex(s, w.id, d.milestoneId)}`,
        link: "dispute",
        refs: { workspaceId: w.id, milestoneId: d.milestoneId, disputeId: d.id },
      });
      const [s2] = addEvidence(s1, w.id, {
        type: "nova_review",
        actorId: NOVA_TEAM_ID,
        title: "Đội ngũ Nova review",
        description: `Đối chiếu tiêu chí nghiệm thu, ${w.submissions.filter((x) => x.milestoneId === d.milestoneId).length} bản nộp và lịch sử trao đổi`,
        milestoneId: d.milestoneId,
        messageId: msg.id,
      });
      return s2;
    }

    case "RESOLVE": {
      const w = state.workspaces[action.wsId];
      const d = w?.disputes.find((x) => x.id === action.disputeId);
      const m = d && milestoneOf(state, action.wsId, d.milestoneId);
      if (!w || !d || !m || d.status === "resolved") return state;
      let s = tick(state);
      const payout = computePayout(m.amount, action.freelancerGross, w.feeTier);
      const status: MilestoneStatus =
        payout.decision === "release" ? "released_sim" : payout.decision === "refund" ? "refunded" : "split";
      s = updateWs(s, w.id, (x) => ({
        ...x,
        disputes: x.disputes.map((y) => (y.id === d.id ? { ...y, status: "resolved" } : y)),
      }));
      s = patchMilestone(s, w.id, m.id, (x) => ({ ...x, status, payout }));
      const [s1, msg] = pushMessage(s, {
        chatId: wsChatId(w.id),
        senderId: NOVA_TEAM_ID,
        kind: "decision",
        link: "evidence",
        refs: { workspaceId: w.id, milestoneId: m.id, disputeId: d.id },
      });
      const label =
        payout.decision === "release" ? "giải ngân" : payout.decision === "refund" ? "hoàn tiền" : "chia tiền";
      const [s2] = addEvidence(s1, w.id, {
        type: "decision",
        actorId: NOVA_TEAM_ID,
        title: `Quyết định: ${label}`,
        description:
          payout.decision === "split"
            ? `Freelancer ${payout.freelancerGross} / Business ${payout.businessRefund} USDC · phí ${payout.fee} USDC (mô phỏng)`
            : payout.decision === "release"
              ? `Freelancer nhận dự kiến ${payout.freelancerNet} USDC · phí ${payout.fee} USDC (mô phỏng)`
              : `Business hoàn dự kiến ${payout.businessRefund} USDC (mô phỏng)`,
        milestoneId: m.id,
        messageId: msg.id,
      });
      return s2;
    }

    case "SET_FEE_TIER":
      return updateWs(state, action.wsId, (w) => ({ ...w, feeTier: action.tier }));
  }
}

/* ---------- selectors ---------- */

/** Tin văn bản hoặc tệp của chính mình trong workspace hoặc nhóm, chưa thu hồi. */
export function canRecall(s: AppState, m: Message): boolean {
  const conv = s.conversations[m.chatId];
  return (
    !m.recalledAt &&
    (m.kind === "text" || m.kind === "file") &&
    m.senderId === me(s) &&
    (conv?.kind === "replyn" || conv?.kind === "group")
  );
}

/** Chỉ workspace giữ tin đã thu hồi (bối cảnh hợp đồng); nhóm xóa hẳn tin, không để lại dòng "đã thu hồi". */
export function keepsRecalled(s: AppState, m: Message): boolean {
  return s.conversations[m.chatId]?.kind === "replyn";
}

/** Tin văn bản, tệp hoặc bản nộp của người dùng trong hội thoại workspace, chưa thu hồi. */
export function canPin(s: AppState, m: Message): boolean {
  const conv = s.conversations[m.chatId];
  return (
    !m.recalledAt &&
    ["text", "file", "submission"].includes(m.kind) &&
    m.senderId !== SYSTEM_ID &&
    m.senderId !== NOVA_TEAM_ID &&
    conv?.kind === "replyn"
  );
}

/** Tin đang ghim trong một hội thoại, mới ghim nhất lên đầu. */
export function pinnedMessages(s: AppState, chatId: string): Message[] {
  return (s.messages[chatId] ?? []).filter((m) => m.pinnedAt && !m.recalledAt).sort((a, b) => b.pinnedAt! - a.pinnedAt!);
}

export function visibleTo(s: AppState, chatId: string): boolean {
  const c = s.conversations[chatId];
  if (!c) return false;
  if (c.kind === "group" || c.kind === "channel") return true;
  return c.memberIds.includes(me(s));
}

/** id workspace Nova (id mờ do Nova cấp) của cuộc trò chuyện đang mở, nếu đó là workspace thật (không phải dữ liệu mẫu). */
export function activeNovaWorkspace(s: AppState): string | null {
  const conv = s.ui.activeChatId ? s.conversations[s.ui.activeChatId] : undefined;
  if (!conv) return null;
  const wsId = conv.workspaceId ?? (conv.linkedWorkspaceChatId ? s.conversations[conv.linkedWorkspaceChatId]?.workspaceId : undefined);
  return (wsId && s.workspaces[wsId]?.agreement?.novaWorkspaceId) || null;
}

/** "Lê Minh Khoa" -> "Minh Khoa" */
function shortName(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).join(" ") || name;
}

/** "2026-11-10" -> "10/11/2026" (định dạng hạn của milestone) */
function isoToDdmmyyyy(value: string | null): string {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

/** Tên Việt: lấy 2 từ cuối (Lê Minh Khoa -> MK, Mộc Coffee -> MC) */
export function initials(name: string): string {
  // Tên dự án từ Nova là văn bản tự do: bỏ dấu câu để "Landing page (E2E)" không thành "P(".
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  return words.slice(-2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** Trạng thái nổi bật nhất của workspace để hiển thị badge ở chat list */
export function workspaceHeadline(w: Workspace): MilestoneStatus | null {
  if (w.milestones.some((m) => m.status === "disputed")) return "disputed";
  const closed: MilestoneStatus[] = ["released_sim", "refunded", "split"];
  const active = w.milestones.find((m) => !closed.includes(m.status));
  return (active ?? w.milestones.at(-1))?.status ?? null;
}

export function findAttachment(s: AppState, id: string | undefined): Attachment | undefined {
  if (!id) return undefined;
  for (const w of Object.values(s.workspaces)) {
    const a = w.attachments.find((x) => x.id === id);
    if (a) return a;
  }
  return s.looseFiles[id];
}
