import {
  ThreadPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  useAuiState,
  type ThreadAssistantMessagePart,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { Spark } from "./Spark";
import { Composer } from "./Composer";
import { Hero } from "./Hero";
import { ResultBlock } from "./ResultBlock";
import { ResultLoading } from "./ResultLoading";
import { Prose } from "./Prose";
import { ToolPartTracker } from "./ToolPartTracker";
import { ErrorBoundary } from "./ErrorBoundary";
import { useInspector } from "@/lib/inspector-store";
import { useLocale } from "@/lib/i18n";
import { AGENT_AVATAR_URL } from "@/lib/product-name";
import { useEffect, useMemo, useRef } from "react";

export function Thread() {
  return (
    <ThreadPrimitive.Root className="thread-root">
      <ThreadPrimitive.Viewport
        className="stage"
        autoScroll={false}
        scrollToBottomOnInitialize={false}
        scrollToBottomOnRunStart={false}
        scrollToBottomOnThreadSwitch={false}
      >
        <ThreadPrimitive.Empty>
          <Hero />
        </ThreadPrimitive.Empty>
        <div className="thread">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </div>
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="msg msg-user">
      <div className="bubble bubble-user">
        <MessagePrimitive.Parts />
      </div>
      <div className="msg-avatar msg-avatar-user" aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  // Read this assistant message's parts so we can aggregate into a single
  // ResultBlock + show a loading state while tools are running and no
  // products have arrived yet.
  const parts = useAuiState((s) => s.message.parts) as readonly ThreadAssistantMessagePart[];
  const status = useAuiState((s) => s.message.status);
  const isRunning = status?.type === "running";

  // Scroll the agent's avatar into view ONLY when this is a fresh in-flight
  // turn — not when an old completed message is restored from localStorage
  // on page reload. Capture isRunning at mount so subsequent updates don't
  // re-trigger the scroll.
  const rootRef = useRef<HTMLDivElement>(null);
  const wasRunningOnMount = useRef(isRunning);
  useEffect(() => {
    if (wasRunningOnMount.current) {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    }
  }, []);

  const toolParts = useMemo(
    () =>
      parts.filter((p): p is ThreadAssistantMessagePart & { type: "tool-call" } =>
        p.type === "tool-call",
      ),
    [parts],
  );

  const text = useMemo(() => {
    const buf: string[] = [];
    for (const p of parts) {
      if (p.type === "text") buf.push(p.text);
    }
    return buf.join("").trim() || null;
  }, [parts]);

  // Pull the "current query" from the latest user message via the inspector
  // (running tools have query in their input args). For the loading state we
  // fall back to the first running tool's args.
  const { entries } = useInspector();
  const runningQuery = useMemo(() => {
    const ids = new Set(toolParts.map((t) => t.toolCallId));
    const running = entries.find((e) => ids.has(e.id) && e.status === "running");
    if (!running) return null;
    const input = running.input as Record<string, unknown> | undefined;
    if (!input) return null;
    if (typeof input.query === "string") return input.query;
    if (typeof input.term === "string") return input.term;
    if (typeof input.category_path === "string") return input.category_path;
    return null;
  }, [entries, toolParts]);

  const traceForLoading = useMemo(() => {
    const ids = new Set(toolParts.map((t) => t.toolCallId));
    return entries
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [entries, toolParts]);

  // A product-yielding tool whose result hasn't arrived yet. We can't drop
  // the loading state on `!text` alone — prose sometimes streams in before
  // the tool result lands, which would otherwise flash a "0 resultados"
  // ResultBlock until the products arrived. An errored tool is treated as
  // resolved so we don't sit on a permanent skeleton.
  const hasUnresolvedProductCall = toolParts.some((t) => {
    const part = t as { result?: unknown; isError?: boolean };
    if (part.isError) return false;
    if (part.result !== undefined) return false;
    return [
      "search_products",
      "browse_category",
      "get_product_by_slug",
      "get_product_by_id",
    ].includes(t.toolName);
  });

  // The whole turn errored (network failure, stall, model exception). User
  // cancellation is intentional and should NOT show the retry tile.
  const isErrored =
    status?.type === "incomplete" &&
    (status.reason === "error" || status.reason === "other");

  // Decide what to render in the body
  const showLoading = isRunning && hasUnresolvedProductCall;
  const showResultBlock = toolParts.length > 0 && !showLoading && !isErrored;

  return (
    <MessagePrimitive.Root ref={rootRef} className="msg msg-assistant">
      <div className="msg-avatar msg-avatar-bot">
        {AGENT_AVATAR_URL ? (
          <img
            src={AGENT_AVATAR_URL}
            alt=""
            className="msg-avatar-img"
            loading="lazy"
          />
        ) : (
          <Spark size={16} />
        )}
      </div>
      <div className="msg-body">
        {/* Side-effect trackers for inspector store. Hidden via Parts. */}
        <MessagePrimitive.Parts
          components={{
            Text: () => null,
            tools: { Fallback: ToolPartTracker as React.ComponentType<ToolCallMessagePartProps> },
          }}
        />

        {showLoading && (
          <ResultLoading query={runningQuery ?? undefined} steps={traceForLoading} />
        )}

        {showResultBlock && (
          <ErrorBoundary
            label="result-block"
            fallback={<TurnRenderError />}
          >
            <ResultBlock toolParts={toolParts as never} text={text} />
          </ErrorBoundary>
        )}

        {!showLoading && !showResultBlock && !isErrored && text && (
          <div className={`msg-text${isRunning ? " is-streaming" : ""}`}>
            <Prose>{text}</Prose>
          </div>
        )}

        {isRunning && !showLoading && !text && toolParts.length === 0 && (
          <ThinkingDots />
        )}

        {isErrored && <TurnErrorTile />}
      </div>
    </MessagePrimitive.Root>
  );
}

function TurnRenderError() {
  const { t } = useLocale();
  return (
    <div className="turn-error" role="alert">
      <div className="turn-error-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <div className="turn-error-text">
        <strong>{t("turn.render_error.title")}</strong>
        <span>{t("turn.render_error.body")}</span>
      </div>
    </div>
  );
}

function TurnErrorTile() {
  const { t } = useLocale();
  return (
    <div className="turn-error" role="alert">
      <div className="turn-error-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <div className="turn-error-text">
        <strong>{t("turn.error.title")}</strong>
        <span>{t("turn.error.body")}</span>
      </div>
      <ActionBarPrimitive.Reload className="turn-error-retry">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        {t("turn.error.retry")}
      </ActionBarPrimitive.Reload>
    </div>
  );
}

function ThinkingDots() {
  const { t } = useLocale();
  return (
    <div className="thinking" role="status" aria-live="polite" aria-busy="true">
      <span className="dot-anim" aria-hidden="true" />
      <span className="dot-anim" aria-hidden="true" />
      <span className="dot-anim" aria-hidden="true" />
      <span style={{ marginLeft: 4 }}>{t("loading.thinking")}</span>
    </div>
  );
}
