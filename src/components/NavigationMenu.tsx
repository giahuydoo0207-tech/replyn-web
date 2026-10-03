"use client";

import { Briefcase, ChevronRight, FileText, ListTodo, MessageCircle, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, type ComponentType } from "react";
import { initials, type ListFilter } from "@/lib/reducer";
import { useMe, useStore } from "@/lib/store";
import { Avatar, IconButton } from "./ui";

type MenuItem = { label: string; hint: string; icon: ComponentType<{ size?: number; className?: string }>; filter?: ListFilter };

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  { title: "Hộp thư", items: [
    { label: "Tin nhắn", hint: "Tất cả cuộc trò chuyện", icon: MessageCircle, filter: "all" },
    { label: "Chưa đọc", hint: "Những cuộc trò chuyện cần xem", icon: Search, filter: "unread" },
    { label: "Dự án", hint: "Các cuộc trao đổi đã chuyển sang làm việc", icon: Briefcase, filter: "replyn" },
    { label: "Việc cần làm", hint: "Điều khoản, nghiệm thu và hỗ trợ", icon: ListTodo, filter: "tasks" },
  ] },
  { title: "Nội dung", items: [
    { label: "Tệp và tài liệu", hint: "Tìm tệp đã gửi trong mọi cuộc trò chuyện", icon: FileText, filter: "files" },
  ] },
];

export function NavigationMenu({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const user = state.users[useMe()];
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current!;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'));
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const els = focusable();
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1)?.focus(); }
      if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0]?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);

  const run = (item: MenuItem) => {
    if (!item.filter) return;
    dispatch({ type: "SET_FILTER", filter: item.filter });
    dispatch({ type: "SET_PANEL", open: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <button className="absolute inset-0 bg-black/55" aria-label="Đóng nền menu" tabIndex={-1} onClick={onClose} />
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Menu Replyn" className="navigation-drawer relative flex h-full w-[336px] max-w-[92vw] flex-col overflow-y-auto border-r border-line bg-sidebar shadow-2xl">
        <div className="border-b border-line p-5">
          <div className="mb-4 flex items-center justify-between"><Avatar initials={initials(user.name)} bg="#233138" fg={user.color} size={52} /><IconButton label="Đóng menu" onClick={onClose}><X size={20} /></IconButton></div>
          <div className="flex items-center gap-2"><UserRound size={17} className="text-muted" /><div><p className="font-semibold">{user.name}</p><p className="mt-0.5 text-sm text-muted">{state.role === "business" ? "Doanh nghiệp" : "Người thực hiện"}</p></div></div>
        </div>
        {SECTIONS.map((section) => (
          <section key={section.title} className="border-b border-line p-2">
            <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted">{section.title}</h2>
            {section.items.map((item) => {
              return <button key={item.label} type="button" onClick={() => run(item)} className="flex w-full items-center gap-4 rounded-lg px-4 py-2.5 text-left hover:bg-hover"><item.icon size={20} className="shrink-0 text-ink-2" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-muted">{item.hint}</span></span><ChevronRight size={14} className="text-muted" /></button>;
            })}
          </section>
        ))}
        <p className="mt-auto px-6 py-5 text-xs leading-relaxed text-muted">Ký quỹ, giải ngân và phí trong bản demo đều là mô phỏng.</p>
      </div>
    </div>
  );
}
