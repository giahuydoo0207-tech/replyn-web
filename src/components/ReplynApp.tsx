"use client";

import { useEffect, useState } from "react";
import { StoreProvider, useActiveChat, useStore } from "@/lib/store";
import { ActionsProvider } from "./actions";
import { ChatList } from "./ChatList";
import { ChatView } from "./chat/ChatView";
import { RightPanel } from "./panel/RightPanel";
import { Rail } from "./Rail";
import { cx } from "./ui";

export function ReplynApp() {
  return (
    <StoreProvider>
      <ActionsProvider>
        <Shell />
      </ActionsProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const { ws } = useActiveChat();
  // mobile: xem danh sách hoặc khung chat
  const [mobileChat, setMobileChat] = useState(false);
  const panelVisible = state.ui.panelOpen && !!ws;
  const closePanel = () => dispatch({ type: "SET_PANEL", open: false });

  // màn hẹp: panel là drawer, mặc định đóng
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1280px)").matches) dispatch({ type: "SET_PANEL", open: false });
  }, [dispatch]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-app text-ink">
      <div className="hidden md:flex">
        <Rail />
      </div>

      <div
        className={cx(
          "h-full w-full shrink-0 border-r border-white/5 md:block md:w-[340px] lg:w-[380px]",
          mobileChat ? "hidden" : "block",
        )}
      >
        <ChatList onOpen={() => setMobileChat(true)} />
      </div>

      <main className={cx("h-full min-w-0 flex-1 md:flex", mobileChat ? "flex" : "hidden")}>
        {/* remount khi chuyển màn trên mobile để cuộn/auto-size tính đúng kích thước */}
        <ChatView key={mobileChat ? "chat" : "list"} onBack={() => setMobileChat(false)} />
      </main>

      {/* Panel: cột cố định từ 1280px, drawer ở màn nhỏ hơn */}
      {panelVisible && (
        <>
          <div className="hidden h-full w-[400px] shrink-0 xl:block 2xl:w-[420px]">
            <RightPanel />
          </div>
          <div className="fixed inset-0 z-40 xl:hidden">
            <button type="button" aria-label="Đóng bảng chi tiết" className="absolute inset-0 bg-black/60" onClick={closePanel} />
            <div className="msg-in absolute inset-y-0 right-0 w-full max-w-[400px] shadow-2xl">
              <RightPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
