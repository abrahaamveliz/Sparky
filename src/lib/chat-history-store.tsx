/**
 * Chat history persistence — simplified version without AI SDK dependency.
 * History is now managed directly by the useChat hook's state.
 * This module is kept for API compatibility with components that import it.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type ChatHistoryValue = {
  chatId: string;
  hasMessages: boolean;
  newConversation: () => void;
  deleteChat: () => void;
};

const Ctx = createContext<ChatHistoryValue | null>(null);

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  // History is now managed by the ChatProvider (useChat hook).
  // This provider is kept as a no-op for backward compatibility.
  const value: ChatHistoryValue = {
    chatId: "default",
    hasMessages: false,
    newConversation: () => {},
    deleteChat: () => {},
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatHistory() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useChatHistory must be used inside ChatHistoryProvider");
  return ctx;
}