/**
 * Pure SSE chat hook — no AI SDK, no @assistant-ui.
 *
 * Consumes the Python backend's SSE protocol:
 *   event: text        data: {"content": "..."}
 *   event: tool_call   data: {"id", "name", "input"}
 *   event: tool_result data: {"id", "name", "result", "is_error"}
 *   event: done        data: {}
 *   event: error       data: {"message": "..."}
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Turnstile site key (set via VITE_ env var)
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

// ── Challenge pre-loading ───────────────────────────────────────
// On page load we run the full pipeline (Turnstile → /api/challenge)
// once, cache the resulting challenge JWT, and reuse it for every
// message within its 5-minute window. A timer regenerates the JWT
// 30 s before it expires so there is always a warm token ready.

let _challengeJwt: string | undefined;
let _challengeAge = 0;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingChallenge: Promise<string | undefined> | null = null;

const CHALLENGE_REFRESH_MS = 4.5 * 60 * 1000; // refresh 30 s before expiry
const CHALLENGE_TTL_MS = 5 * 60 * 1000;       // JWT validity window

/**
 * Render an invisible Turnstile widget and resolve with the response
 * token. Falls back to undefined when Turnstile is not configured or
 * the script hasn't loaded yet.
 */
function renderTurnstileToken(): Promise<string | undefined> {
  const turnstile = (window as any).turnstile;
  if (!turnstile || !TURNSTILE_SITE_KEY) return Promise.resolve(undefined);

  return new Promise<string | undefined>((resolve) => {
    let settled = false;
    const done = (token: string | undefined) => {
      if (settled) return;
      settled = true;
      setTimeout(() => {
        turnstile.remove(widgetId);
        container.remove();
      }, 100);
      resolve(token);
    };

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    const widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "invisible",
      callback: (token: string) => done(token),
      "error-callback": () => done(undefined),
      "expired-callback": () => done(undefined),
    });

    setTimeout(() => done(undefined), 10_000);
  });
}

/**
 * Run the full pipeline: Turnstile token → /api/challenge → JWT.
 * Caches the JWT and schedules the next refresh.
 */
function warmChallenge(): Promise<string | undefined> {
  if (_refreshTimer) clearTimeout(_refreshTimer);

  const promise = renderTurnstileToken()
    .then(async (turnstileToken) => {
      try {
        const res = await fetch("/api/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnstile: turnstileToken }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.challenge as string | undefined;
        }
      } catch {
        // If challenge endpoint fails, proceed without — server decides
      }
      return undefined;
    })
    .then((jwt) => {
      _challengeJwt = jwt;
      _challengeAge = Date.now();
      _pendingChallenge = null;
      // Schedule auto-refresh before expiry
      _refreshTimer = setTimeout(() => {
        _pendingChallenge = warmChallenge();
      }, CHALLENGE_REFRESH_MS);
      return jwt;
    });

  _pendingChallenge = promise;
  return promise;
}

/**
 * Return the cached challenge JWT, reused for every message within
 * its 5-minute window. Only the background timer triggers a new
 * Turnstile + /api/challenge round-trip.
 */
async function getChallengeToken(): Promise<string | undefined> {
  if (_pendingChallenge) await _pendingChallenge;

  const age = Date.now() - _challengeAge;
  if (!_challengeJwt || age >= CHALLENGE_TTL_MS) {
    await warmChallenge();
  }

  return _challengeJwt;
}

// Kick off preloading as soon as the Turnstile script is available.
// _pendingChallenge is set synchronously so that a message sent before
// the script loads will await this promise rather than skipping.
if (TURNSTILE_SITE_KEY) {
  const waitForTurnstile = (): Promise<void> => {
    if ((window as any).turnstile) return Promise.resolve();
    return new Promise((resolve) => {
      const poll = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); resolve(); }, 30_000);
    });
  };
  _pendingChallenge = waitForTurnstile().then(() => warmChallenge());
}

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResult = {
  id: string;
  name: string;
  result: unknown;
  is_error: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

type ChatState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => void;
  retry: () => void;
  clear: () => void;
};

const ChatContext = createContext<ChatState | null>(null);

let msgIdCounter = 0;
function nextId() {
  return `msg-${++msgIdCounter}-${Date.now()}`;
}

// Tools whose results contain bulky product data that the model only
// needs in condensed form (name, brand, price, productId).
const _PRODUCT_TOOLS = new Set([
  "search_products",
  "browse_category",
  "get_product_by_slug",
  "get_product_by_id",
]);

/**
 * Condense a product-tool result for the round-trip payload.
 *
 * Only the first 10 products are kept (name, brand, price, productId) —
 * enough for the model to reference what was shown. The full count is
 * preserved so the model knows the real result size. This mirrors the
 * server's _condense_for_model and additionally caps the list so even
 * large category browses stay under a few hundred bytes.
 */
const MAX_PRODUCTS_FOR_MODEL = 10;

function condenseToolResult(tr: ToolResult): string {
  if (tr.is_error || !_PRODUCT_TOOLS.has(tr.name)) {
    return typeof tr.result === "string"
      ? tr.result
      : JSON.stringify(tr.result);
  }

  try {
    const data =
      typeof tr.result === "string" ? JSON.parse(tr.result) : tr.result;
    if (!data || typeof data !== "object") throw 0;

    const products = (data as Record<string, unknown>).products;
    if (!Array.isArray(products)) throw 0;

    const condensed = products
      .slice(0, MAX_PRODUCTS_FOR_MODEL)
      .map((p: Record<string, unknown>) => ({
        name: p.name ?? "",
        brand: p.brand ?? "",
        sellingPrice: p.sellingPrice,
        listPrice: p.listPrice,
        productId: p.productId ?? "",
      }));

    return JSON.stringify({
      total: (data as Record<string, unknown>).total ?? products.length,
      products: condensed,
    });
  } catch {
    return typeof tr.result === "string"
      ? tr.result
      : JSON.stringify(tr.result);
  }
}

/** Build the message payload the Python backend expects (OpenAI format). */
function toApiMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", content: msg.content });
    } else {
      // Assistant message: content is a plain string, tool_calls is an array
      const assistantMsg: Record<string, unknown> = { role: "assistant" };
      if (msg.content) {
        assistantMsg.content = msg.content;
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        }));
      }
      out.push(assistantMsg);

      // Each tool result is a separate "tool" message
      if (msg.toolResults && msg.toolResults.length > 0) {
        for (const tr of msg.toolResults) {
          out.push({
            role: "tool",
            tool_call_id: tr.id,
            content: condenseToolResult(tr),
          });
        }
      }
    }
  }

  return out;
}

/**
 * Parse complete SSE events from a buffer.
 * SSE events are separated by double newlines (\n\n).
 */
function parseSSEBuffer(buffer: string): [Array<{ event: string; data: string }>, string] {
  const events: Array<{ event: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() || "";

  for (const part of parts) {
    if (!part.trim()) continue;
    let eventType = "";
    let dataStr = "";

    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6);
      }
    }

    if (eventType && dataStr) {
      events.push({ event: eventType, data: dataStr });
    }
  }

  return [events, remaining];
}

export function ChatProvider({
  children,
  locale = "es",
  preferences,
}: {
  children: ReactNode;
  locale?: string;
  preferences?: Record<string, unknown>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Use a ref to accumulate updates and flush via RAF for smooth text streaming
  const pendingRef = useRef<{
    assistantId: string;
    textDelta: string;
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    rafId: number | null;
  } | null>(null);

  /** Flush accumulated deltas into React state. */
  function flushPending() {
    const p = pendingRef.current;
    if (!p) return;

    const { assistantId, textDelta, toolCalls, toolResults } = p;
    // Reset pending
    p.textDelta = "";
    p.toolCalls = [];
    p.toolResults = [];
    p.rafId = null;

    if (!textDelta && toolCalls.length === 0 && toolResults.length === 0) return;

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === assistantId);
      if (idx === -1) return prev;

      const msg = { ...prev[idx] };
      if (textDelta) msg.content += textDelta;
      if (toolCalls.length > 0) msg.toolCalls = [...(msg.toolCalls || []), ...toolCalls];
      if (toolResults.length > 0) msg.toolResults = [...(msg.toolResults || []), ...toolResults];

      const next = [...prev];
      next[idx] = msg;
      return next;
    });
  }

  /** Schedule a flush on the next animation frame. */
  function scheduleFlush() {
    const p = pendingRef.current;
    if (!p || p.rafId !== null) return;
    p.rafId = requestAnimationFrame(flushPending);
  }

  function handleEvent(
    assistantId: string,
    event: string,
    data: Record<string, unknown>,
  ) {
    if (!pendingRef.current || pendingRef.current.assistantId !== assistantId) {
      pendingRef.current = {
        assistantId,
        textDelta: "",
        toolCalls: [],
        toolResults: [],
        rafId: null,
      };
    }

    const p = pendingRef.current;

    switch (event) {
      case "text":
        p.textDelta += (data.content as string) || "";
        scheduleFlush();
        break;
      case "tool_call":
        p.toolCalls.push({
          id: data.id as string,
          name: data.name as string,
          input: data.input as Record<string, unknown>,
        });
        // Tool calls flush immediately so the UI can show "searching..."
        flushPending();
        break;
      case "tool_result":
        p.toolResults.push({
          id: data.id as string,
          name: data.name as string,
          result: data.result,
          is_error: (data.is_error as boolean) || false,
        });
        // Tool results flush immediately to show products ASAP
        flushPending();
        break;
      case "error":
        setError((data.message as string) || "Unknown error");
        break;
      case "done":
        // Final flush for any remaining text
        flushPending();
        break;
    }
  }

  const streamResponse = useCallback(
    async (allMessages: ChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);

      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        toolResults: [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        // Use the preloaded challenge JWT (reusable within its 5-min window)
        const challengeToken = await getChallengeToken();

        const apiMessages = toApiMessages(allMessages);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (challengeToken) {
          headers["X-Challenge"] = challengeToken;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: apiMessages,
            locale,
            preferences,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const [events, remaining] = parseSSEBuffer(buffer);
          buffer = remaining;

          for (const { event, data: dataStr } of events) {
            try {
              const data = JSON.parse(dataStr);
              handleEvent(assistantId, event, data);
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const [events] = parseSSEBuffer(buffer + "\n\n");
          for (const { event, data: dataStr } of events) {
            try {
              const data = JSON.parse(dataStr);
              handleEvent(assistantId, event, data);
            } catch {
              // Skip
            }
          }
        }

        // Final flush
        flushPending();
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        }
      } finally {
        // Cancel any pending RAF
        if (pendingRef.current?.rafId) {
          cancelAnimationFrame(pendingRef.current.rafId);
        }
        flushPending();
        pendingRef.current = null;
        setIsStreaming(false);
      }
    },
    [locale, preferences],
  );

  const send = useCallback(
    (text: string) => {
      if (isStreaming || !text.trim()) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text.trim(),
      };

      const updated = [...messages, userMsg];
      setMessages(updated);
      streamResponse(updated);
    },
    [isStreaming, messages, streamResponse],
  );

  const retry = useCallback(() => {
    if (isStreaming) return;

    setMessages((prev) => {
      const trimmed = prev.filter(
        (_, i) => !(i === prev.length - 1 && prev[i].role === "assistant"),
      );
      streamResponse(trimmed);
      return trimmed;
    });
  }, [isStreaming, streamResponse]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (pendingRef.current?.rafId) {
      cancelAnimationFrame(pendingRef.current.rafId);
    }
    pendingRef.current = null;
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, isStreaming, error, send, retry, clear }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}