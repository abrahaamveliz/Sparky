import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UIMessage } from "ai";
import { useDebouncedStorage } from "./use-debounced-storage";

const STORAGE_KEY = "walmart-mcp:chat";

type Stored = {
  id: string;
  messages: UIMessage[];
  updatedAt: number;
};

function makeFreshId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

function makeFresh(): Stored {
  return { id: makeFreshId(), messages: [], updatedAt: Date.now() };
}

function load(): Stored {
  if (typeof window === "undefined") return makeFresh();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeFresh();
    const parsed = JSON.parse(raw) as Stored;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      Array.isArray(parsed.messages) &&
      typeof parsed.updatedAt === "number"
    ) {
      return parsed;
    }
  } catch {}
  return makeFresh();
}

type ChatHistoryValue = {
  /** Stable per-conversation id; flips when newConversation/deleteChat is
   *  called. Used as a `key` on the runtime shell to force a clean remount. */
  chatId: string;
  /** Messages to seed the runtime with on (re)mount. */
  initialMessages: UIMessage[];
  /** Whether there's anything to delete. */
  hasMessages: boolean;
  /** Persist the latest messages snapshot from the runtime. */
  saveMessages: (messages: UIMessage[]) => void;
  /** Start a fresh conversation (clears messages, new id). */
  newConversation: () => void;
  /** Delete the current chat (same effect; semantically distinct in UI). */
  deleteChat: () => void;
};

const Ctx = createContext<ChatHistoryValue | null>(null);

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(load);

  useDebouncedStorage(STORAGE_KEY, stored);

  const saveMessages = useCallback((messages: UIMessage[]) => {
    setStored((prev) => {
      // No-op when the runtime fires onFinish with the same array we already
      // have (avoids a localStorage churn on every re-render).
      if (prev.messages === messages) return prev;
      return { ...prev, messages, updatedAt: Date.now() };
    });
  }, []);

  const newConversation = useCallback(() => {
    setStored(makeFresh());
  }, []);

  const deleteChat = useCallback(() => {
    setStored(makeFresh());
  }, []);

  const value = useMemo<ChatHistoryValue>(
    () => ({
      chatId: stored.id,
      initialMessages: stored.messages,
      hasMessages: stored.messages.length > 0,
      saveMessages,
      newConversation,
      deleteChat,
    }),
    [stored, saveMessages, newConversation, deleteChat],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatHistory() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useChatHistory must be used inside ChatHistoryProvider");
  return ctx;
}
