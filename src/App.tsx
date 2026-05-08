import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Topbar } from "@/components/Topbar";
import { SubNavbar } from "@/components/SubNavbar";
import { Thread } from "@/components/Thread";
import { CartDrawer } from "@/components/CartDrawer";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PreferencesDrawer } from "@/components/PreferencesDrawer";
import { InspectorProvider } from "@/lib/inspector-store";
import { CartProvider } from "@/lib/cart-store";
import { LocaleProvider, useLocale } from "@/lib/i18n";
import {
  PreferencesProvider,
  usePreferences,
} from "@/lib/preferences-store";
import {
  ErrorProvider,
  classifyClientError,
  useErrorStore,
} from "@/lib/error-store";
import {
  ChatHistoryProvider,
  useChatHistory,
} from "@/lib/chat-history-store";

// Locked to Sonnet 4.5 — the only model on OCR Arena fast enough for
// real-time tool calls. Other proxy targets (Gemini, GPT) work but go
// through a non-Claude retry path that adds 5-15s of latency per turn.
const MODEL_ID = "claude-sonnet-4-5";

/**
 * Inner shell — re-mounted whenever the active chat id changes (via the
 * `key` on the parent `<ChatShell>`). This is what gives us a clean
 * runtime + thread state when the user starts a new conversation or
 * deletes the current one.
 */
function ChatShellInner() {
  const { locale } = useLocale();
  const { preferences } = usePreferences();
  const { setError } = useErrorStore();
  const { initialMessages, saveMessages } = useChatHistory();

  const [cartOpen, setCartOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Refs so the transport body callback (frozen at construction) always
  // reads the latest values without re-creating the transport.
  const localeRef = useRef(locale);
  const prefsRef = useRef(preferences);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  useEffect(() => {
    prefsRef.current = preferences;
  }, [preferences]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          model: MODEL_ID,
          locale: localeRef.current,
          preferences: prefsRef.current,
        }),
      }),
    [],
  );

  const onError = useCallback(
    (err: unknown) => {
      console.error("[chat]", err);
      setError(classifyClientError(err));
    },
    [setError],
  );

  // Persist on every assistant-turn completion. We snapshot the messages
  // array directly off the runtime via a side-effect rather than passing
  // onFinish into useChatRuntime, because the saved messages need to be
  // the post-finish state including tool results.
  const runtime = useChatRuntime({
    transport,
    messages: initialMessages,
    onError,
    onFinish: ({ messages }: { messages: UIMessage[] }) => {
      saveMessages(messages);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <InspectorProvider>
        <CartProvider>
          <div className="app">
            <Topbar
              onOpenCart={() => setCartOpen(true)}
              onOpenPrefs={() => setPrefsOpen(true)}
            />
            <SubNavbar onOpenCart={() => setCartOpen(true)} />
            <ErrorBanner />
            <section className="chat-shell">
              <Thread />
            </section>
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
            <PreferencesDrawer
              open={prefsOpen}
              onClose={() => setPrefsOpen(false)}
            />
          </div>
        </CartProvider>
      </InspectorProvider>
    </AssistantRuntimeProvider>
  );
}

function ChatShell() {
  const { chatId } = useChatHistory();
  // The key here is the load-bearing piece: changing chatId remounts the
  // entire shell, which gives us a fresh runtime seeded with the new
  // chat's initial messages (or no messages, for a brand-new chat).
  return <ChatShellInner key={chatId} />;
}

export function App() {
  return (
    <LocaleProvider>
      <ErrorProvider>
        <PreferencesProvider>
          <ChatHistoryProvider>
            <ChatShell />
          </ChatHistoryProvider>
        </PreferencesProvider>
      </ErrorProvider>
    </LocaleProvider>
  );
}
