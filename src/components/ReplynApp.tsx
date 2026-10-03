"use client";

import { useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
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
  // mobile: xem danh sách hoặc khung chat
  const [mobileChat, setMobileChat] = useState(false);
  const panelVisible = state.ui.panelOpen;

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

      <main className={cx("h-full min-w-0 flex-1", mobileChat ? "flex" : "hidden md:flex")}>
        {panelVisible ? (
          <RightPanel onBack={() => {
            dispatch({ type: "SET_PANEL", open: false });
            setMobileChat(true);
          }} />
        ) : (
          <ChatView key={mobileChat ? "chat" : "list"} onBack={() => setMobileChat(false)} />
        )}
      </main>
    </div>
  );
}
