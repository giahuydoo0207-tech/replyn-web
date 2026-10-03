import { FileCheck2, FolderOpen, ListChecks, ScrollText, TriangleAlert } from "lucide-react";
import type { PanelTab } from "@/lib/reducer";

export const PROJECT_TOOLS = [
  { tab: "terms", label: "Thỏa thuận", menuLabel: "Xem thỏa thuận", icon: FileCheck2, hint: "Phạm vi, thời hạn và cam kết" },
  { tab: "milestones", label: "Tiến độ", menuLabel: "Theo dõi tiến độ", icon: ListChecks, hint: "Giai đoạn, nghiệm thu và giải ngân" },
  { tab: "files", label: "Sản phẩm", menuLabel: "Bàn giao sản phẩm", icon: FolderOpen, hint: "Tệp bàn giao và các phiên bản" },
  { tab: "evidence", label: "Nhật ký", menuLabel: "Xem nhật ký", icon: ScrollText, hint: "Lịch sử hoạt động của dự án" },
  { tab: "dispute", label: "Hỗ trợ", menuLabel: "Yêu cầu hỗ trợ", icon: TriangleAlert, hint: "Bất đồng và phương án xử lý" },
] satisfies { tab: PanelTab; label: string; menuLabel: string; icon: typeof FileCheck2; hint: string }[];
