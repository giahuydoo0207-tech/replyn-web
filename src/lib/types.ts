export type Role = "business" | "freelancer";

export interface User {
  id: string;
  name: string;
  short: string; // tên ngắn hiển thị trong bubble
  title: string;
  color: string; // màu tên trong group, kiểu Telegram
  avatar?: string; // initials override
}

export type FeeTier = "BASIC" | "ADVANCED";

export type MilestoneStatus =
  | "awaiting_funding" // Chờ cấp vốn
  | "funded_sim" // Đã ký quỹ (mô phỏng)
  | "submitted" // Đã nộp sản phẩm
  | "in_review" // Đang chờ nghiệm thu
  | "revision_requested" // Yêu cầu sửa
  | "ready_to_release" // Đủ điều kiện giải ngân
  | "disputed" // Đang tranh chấp
  | "released_sim" // Đã giải ngân (mô phỏng)
  | "refunded" // Quyết định hoàn tiền
  | "split"; // Quyết định chia tiền

export interface Milestone {
  id: string;
  title: string;
  amount: number; // USDC
  status: MilestoneStatus;
  deadline: string; // dd/mm/yyyy
  reviewDays: number;
  revisionLimit: number;
  revisionsUsed: number;
  criteria: string[];
  scope?: string;
  deliverables?: string[];
  submissionIds: string[];
  payout?: Payout;
}

export interface Payout {
  decision: "release" | "refund" | "split";
  freelancerGross: number;
  fee: number;
  freelancerNet: number;
  businessRefund: number;
}

export interface Attachment {
  id: string;
  name: string;
  size: number; // bytes
  hash: string; // sha-256 hex
  version?: number;
  milestoneId?: string;
  uploadedBy: string;
  at: number;
  kind: "file" | "image";
}

export interface Submission {
  id: string;
  milestoneId: string;
  version: number;
  attachmentId: string;
  note: string;
  at: number;
  messageId: string;
}

export type DisputeStatus = "open" | "reviewing" | "resolved";

export interface Dispute {
  id: string;
  milestoneId: string;
  openedBy: string;
  reason: string;
  at: number;
  status: DisputeStatus;
  evidenceAttachmentIds: string[];
  messageId: string;
}

export type EvidenceType =
  | "workspace_created"
  | "terms_locked"
  | "funded"
  | "submitted"
  | "revision"
  | "resubmitted"
  | "accepted"
  | "dispute_opened"
  | "nova_review"
  | "decision"
  | "released";

export interface EvidenceEvent {
  id: string;
  type: EvidenceType;
  actorId: string;
  at: number;
  title: string;
  description: string;
  milestoneId?: string;
  messageId?: string;
  attachmentId?: string;
}

export interface Workspace {
  id: string;
  title: string;
  businessId: string;
  freelancerId: string;
  feeTier: FeeTier;
  termsLockedAt: number | null; // null = hai bên chưa khóa điều khoản
  milestones: Milestone[];
  attachments: Attachment[];
  submissions: Submission[];
  disputes: Dispute[];
  evidence: EvidenceEvent[];
  /** Có khi workspace được mở từ đề xuất Nova thật (không phải dữ liệu mẫu). */
  agreement?: NovaAgreement;
}

export type MessageKind =
  | "text"
  | "file"
  | "system"
  | "milestone"
  | "submission"
  | "payment"
  | "dispute"
  | "decision";

export interface MessageRefs {
  workspaceId?: string;
  milestoneId?: string;
  submissionId?: string;
  disputeId?: string;
  attachmentId?: string;
  auditEventId?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string; // user id | "replyn" | "nova-team"
  at: number;
  kind: MessageKind;
  text?: string;
  replyToId?: string;
  refs?: MessageRefs;
  /** tab của panel Replyn Protection mà notice trỏ tới */
  link?: "terms" | "milestones" | "files" | "evidence" | "dispute";
  /** Người gửi đã thu hồi: chat chỉ hiện dòng thông báo, tab Lưu trữ vẫn giữ nội dung để hai bên đối chiếu. */
  recalledAt?: number;
}

/** Giai đoạn của một đề xuất đã được chấp nhận trên Nova, dùng để dựng workspace. */
export interface ProposalDraft {
  projectTitle: string;
  feeTier: FeeTier;
  milestones: Pick<Milestone, "id" | "title" | "amount" | "deadline" | "criteria" | "scope" | "deliverables">[];
}

/**
 * Thỏa thuận gốc: doanh nghiệp đề xuất trong Nova, freelancer chấp nhận trong Nova Mobile. Replyn chỉ hiển thị
 * và thực thi thỏa thuận này, không bao giờ tạo đề xuất.
 */
export interface NovaAgreement {
  /** id workspace mờ do Nova cấp khi đề xuất được chấp nhận */
  novaWorkspaceId: string;
  scope: string;
  deliverables: string[];
  notes: string;
  totalAmount: number;
  currency: string;
  startDate: string | null;
  deadline: string | null;
  /** Thời điểm freelancer chấp nhận đề xuất trên Nova; cũng là lúc thỏa thuận được khóa. */
  acceptedAt: number;
  /** Chỉ có với doanh nghiệp khi server cấu hình NOVA_BUSINESS_WEB_URL và Nova gửi id cuộc trò chuyện. */
  novaReturnUrl?: string;
}

export interface Conversation {
  id: string;
  kind: "nova" | "replyn" | "group" | "channel";
  title: string;
  subtitle: string;
  avatar: { initials: string; bg: string; fg: string };
  memberIds: string[];
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  workspaceId?: string;
  /** Hội thoại Nova (chỉ xem) đã dẫn tới workspace này. */
  linkedWorkspaceChatId?: string;
  /** Hội thoại Nova đã tạo ra workspace này, dùng để quay lại từ workspace. */
  sourceNovaChatId?: string;
}
