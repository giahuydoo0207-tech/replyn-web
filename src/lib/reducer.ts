import { computePayout } from "./fees";
import { defaultTab } from "./protection";
import type {
  Attachment,
  Conversation,
  EvidenceEvent,
  FeeTier,
  Message,
  Milestone,
  MilestoneStatus,
  ProposalDraft,
  Role,
  User,
  Workspace,
} from "./types";

export type PanelTab = "terms" | "milestones" | "files" | "evidence" | "dispute";
export type ListFilter = "all" | "unread" | "replyn" | "tasks" | "files" | "review" | "dispute";

export interface UiState {
  activeChatId: string | null;
  panelTab: PanelTab;
  panelOpen: boolean;
  filter: ListFilter;
  flashId: string | null; // message/evidence vừa được nhảy tới
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
  | { type: "SET_PANEL"; tab?: PanelTab; open?: boolean }
  | { type: "SET_FILTER"; filter: ListFilter }
  | { type: "TOGGLE_PIN"; chatId: string }
  | { type: "TOGGLE_MUTE"; chatId: string }
  | { type: "FLASH"; id: string | null }
  | { type: "SEND_TEXT"; chatId: string; text: string; senderId?: string; replyToId?: string }
  | { type: "SEND_FILE"; chatId: string; file: NewFile; senderId?: string; text?: string }
  | { type: "PROPOSE_REPLYN"; chatId: string; senderId?: string }
  | { type: "PROPOSAL_LATER"; chatId: string }
  | { type: "OPEN_REPLYN"; chatId: string }
  | {
      type: "CREATE_WORKSPACE";
      wsId: string;
      title: string;
      businessId: string;
      freelancerId: string;
      feeTier: FeeTier;
      draft: ProposalDraft["milestones"];
      fromNova?: string;
      unread?: number;
    }
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
  refunded: "Quyết định hoàn tiền",
  split: "Quyết định chia tiền",
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

    case "PROPOSE_REPLYN": {
      const conv = state.conversations[action.chatId];
      if (!conv?.proposal) return state;
      const s = tick(state);
      const [s1, msg] = pushMessage(s, {
        chatId: conv.id,
        senderId: action.senderId ?? me(s),
        kind: "proposal",
      });
      return {
        ...s1,
        conversations: {
          ...s1.conversations,
          [conv.id]: {
            ...s1.conversations[conv.id],
            proposalStatus: "pending",
            proposalMessageId: msg.id,
          },
        },
      };
    }

    case "PROPOSAL_LATER": {
      const conv = state.conversations[action.chatId];
      if (!conv) return state;
      return {
        ...state,
        conversations: { ...state.conversations, [conv.id]: { ...conv, proposalStatus: "later" } },
      };
    }

    case "OPEN_REPLYN": {
      const conv = state.conversations[action.chatId];
      if (!conv?.proposal) return state;
      if (conv.linkedWorkspaceChatId) {
        return reducer(state, { type: "SELECT_CHAT", chatId: conv.linkedWorkspaceChatId });
      }
      const [businessId, freelancerId] = splitRoles(state, conv.memberIds);
      const [s0, wsId] = nextId(state, "ws");
      let s = reducer(s0, {
        type: "CREATE_WORKSPACE",
        wsId,
        title: conv.proposal.projectTitle,
        businessId,
        freelancerId,
        feeTier: conv.proposal.feeTier,
        draft: conv.proposal.milestones,
        fromNova: conv.id,
      });
      s = {
        ...s,
        conversations: {
          ...s.conversations,
          [conv.id]: {
            ...s.conversations[conv.id],
            proposalStatus: "opened",
            linkedWorkspaceChatId: wsChatId(wsId),
          },
        },
      };
      s = {
        ...s,
        ui: { ...s.ui, panelTab: "milestones" },
      };
      return reducer(s, { type: "SELECT_CHAT", chatId: wsChatId(wsId) });
    }

    case "CREATE_WORKSPACE": {
      const s = tick(state);
      const chatId = wsChatId(action.wsId);
      const business = s.users[action.businessId];
      const milestones: Milestone[] = action.draft.map((d) => ({
        ...d,
        status: "awaiting_funding",
        reviewDays: 3,
        revisionLimit: 2,
        revisionsUsed: 0,
        submissionIds: [],
      }));
      const ws: Workspace = {
        id: action.wsId,
        title: action.title,
        businessId: action.businessId,
        freelancerId: action.freelancerId,
        feeTier: action.feeTier,
        termsLockedAt: null,
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
        subtitle: `${business.name} · ${s.users[action.freelancerId].name}`,
        avatar: { initials: initials(action.title), bg: "#233138", fg: "#e9edef" },
        memberIds: [action.businessId, action.freelancerId],
        unread: action.unread ?? 0,
        workspaceId: action.wsId,
        sourceNovaChatId: action.fromNova,
      };
      let s1: AppState = {
        ...s,
        workspaces: { ...s.workspaces, [action.wsId]: ws },
        conversations: { ...s.conversations, [chatId]: conv },
        messages: { ...s.messages, [chatId]: [] },
      };
      [s1] = pushMessage(s1, {
        chatId,
        senderId: SYSTEM_ID,
        kind: "system",
        text: "Workspace Replyn được tạo",
      });
      let s3 = s1;
      [s3] = addEvidence(s3, action.wsId, {
        type: "workspace_created",
        actorId: SYSTEM_ID,
        title: "Workspace được tạo",
        description: action.fromNova
          ? `Từ đề xuất trên Nova Chat · ${milestones.length} milestone, chờ hai bên khóa điều khoản`
          : `${milestones.length} milestone, chờ hai bên khóa điều khoản`,
        messageId: s3.messages[chatId][0].id,
      });
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

export function visibleTo(s: AppState, chatId: string): boolean {
  const c = s.conversations[chatId];
  if (!c) return false;
  if (c.kind === "group" || c.kind === "channel") return true;
  return c.memberIds.includes(me(s));
}

export function splitRoles(s: AppState, memberIds: string[]): [string, string] {
  const business = memberIds.find((id) => id === s.roleUser.business) ?? memberIds[0];
  const freelancer = memberIds.find((id) => id !== business) ?? memberIds[1];
  return [business, freelancer];
}

/** Tên Việt: lấy 2 từ cuối (Lê Minh Khoa -> MK, Mộc Coffee -> MC) */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
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
