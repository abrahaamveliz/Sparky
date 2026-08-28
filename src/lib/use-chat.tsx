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

/**
 * Render an invisible Turnstile widget and resolve with the response
 * token. Falls back to undefined when Turnstile is not configured or
 * the script hasn't loaded yet.
 *
 * The container must be in the DOM and not display:none — invisible
 * Turnstile still needs a live element to execute its challenge. We
 * position it off-screen so it doesn't affect layout.
 */
function getTurnstileToken(): Promise<string | undefined> {
  const turnstile = (window as any).turnstile;
  if (!turnstile || !TURNSTILE_SITE_KEY) return Promise.resolve(undefined);

  return new Promise<string | undefined>((resolve) => {
    let settled = false;
    const done = (token: string | undefined) => {
      if (settled) return;
      settled = true;
      // Clean up the container after resolving
      setTimeout(() => {
        turnstile.remove(widgetId);
        container.remove();
      }, 100);
      resolve(token);
    };

    // Container must be visible in the DOM for Turnstile to run,
    // but positioned off-screen so the user sees nothing.
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

    // Safety timeout — if Turnstile hangs, don't block the chat forever
    setTimeout(() => done(undefined), 10_000);
  });
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

/** Build the message payload the Python backend expects. */
function toApiMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", content: msg.content });
    } else {
      const content: Record<string, unknown>[] = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      out.push({ role: "assistant", content });

      if (msg.toolResults && msg.toolResults.length > 0) {
        out.push({
          role: "user",
          content: msg.toolResults.map((tr) => ({
            type: "tool_result",
            tool_use_id: tr.id,
            content:
              typeof tr.result === "string"
                ? tr.result
                : JSON.stringify(tr.result),
            is_error: tr.is_error,
          })),
        });
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
        // Step 1: Acquire a one-time challenge token (anti-replay)
        let challengeToken: string | undefined;
        try {
          const turnstileToken = await getTurnstileToken();
          const challengeRes = await fetch("/api/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turnstile: turnstileToken }),
            signal: controller.signal,
          });
          if (challengeRes.ok) {
            const challengeData = await challengeRes.json();
            challengeToken = challengeData.challenge;
          }
        } catch {
          // If challenge fails, try the chat request anyway — the server
          // will reject it if challenge validation is enforced.
        }

        // Step 2: Send chat request with challenge header
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