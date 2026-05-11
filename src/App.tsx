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
import { SkipLink } from "@/components/SkipLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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

// If the stream delivers no bytes for this long, abort and let the runtime
// surface an error tile with a Retry. Recipe-mode turns fan out to 5+ MCP
// search_products calls in sequence; a single slow MCP call (~6-10s) plus
// the LLM's tool-result reflection (~3-5s) can produce a 15-20s quiet
// stretch even on a healthy connection. 45s gives ~2x headroom over the
// observed worst-case quiet stretch without making a truly stalled
// connection look hung indefinitely.
const STREAM_IDLE_TIMEOUT_MS = 45_000;

/** Fetch wrapper that aborts the request if the response body sits idle for
 *  STREAM_IDLE_TIMEOUT_MS. Composes with any caller-supplied AbortSignal. */
async function stallAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const upstream = new AbortController();
  const onCallerAbort = () => upstream.abort(init!.signal!.reason);
  if (init?.signal) {
    if (init.signal.aborted) upstream.abort(init.signal.reason);
    else init.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  const res = await fetch(input, { ...init, signal: upstream.signal });
  if (!res.body) return res;

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      upstream.abort(new DOMException("Stream stalled", "AbortError"));
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  const disarm = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    init?.signal?.removeEventListener("abort", onCallerAbort);
  };

  armIdle();
  const reader = res.body.getReader();
  const watched = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          disarm();
          controller.close();
          return;
        }
        armIdle();
        controller.enqueue(value);
      } catch (err) {
        disarm();
        controller.error(err);
      }
    },
    cancel(reason) {
      disarm();
      reader.cancel(reason).catch(() => {});
    },
  });

  return new Response(watched, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * Inner shell — re-mounted whenever the active chat id changes (via the
 * `key` on the parent `<ChatShell>`). This is what gives us a clean
 * runtime + thread state when the user starts a new conversation or
 * deletes the current one.
 */
function ChatShellInner() {
  const { locale, t } = useLocale();
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

  // Keep the document title in sync with the active locale so the browser
  // tab matches the UI language (the static value in index.html is just
  // the initial paint).
  useEffect(() => {
    document.title = t("a11y.app_title");
  }, [t]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          model: MODEL_ID,
          locale: localeRef.current,
          preferences: prefsRef.current,
        }),
        // Custom fetch that aborts the request if the stream goes idle for
        // STREAM_IDLE_TIMEOUT_MS. The browser's fetch has no built-in way
        // to time out a stream that's connected but not delivering bytes,
        // so we observe the response body and reset a timer on every chunk.
        fetch: stallAwareFetch,
      }),
    [],
  );

  const onError = useCallback(
    (err: unknown) => {
      if (import.meta.env.DEV) console.error("[chat]", err);
      const classified = classifyClientError(err);
      // The inline turn-error tile inside Thread already surfaces a Retry
      // for transient stream interruptions (network drops, stalls,
      // mid-stream aborts, model glitches). Showing the global red banner
      // ALSO for these cases doubles up the same message — noisy. Only
      // raise the global banner for errors the user can't recover from
      // by clicking Retry: server misconfig and auth issues.
      if (classified.category === "config" || classified.category === "auth") {
        setError(classified);
      }
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
            <SkipLink />
            <Topbar
              onOpenCart={() => setCartOpen(true)}
              onOpenPrefs={() => setPrefsOpen(true)}
            />
            <SubNavbar onOpenCart={() => setCartOpen(true)} />
            <ErrorBanner />
            <main id="main" className="chat-shell" tabIndex={-1}>
              <h1 className="sr-only">{t("a11y.app_title")}</h1>
              <Thread />
            </main>
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
    <ErrorBoundary label="app">
      <LocaleProvider>
        <ErrorProvider>
          <PreferencesProvider>
            <ChatHistoryProvider>
              <ChatShell />
            </ChatHistoryProvider>
          </PreferencesProvider>
        </ErrorProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
