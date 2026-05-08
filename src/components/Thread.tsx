import {
  ThreadPrimitive,
  MessagePrimitive,
  useAuiState,
  type ThreadAssistantMessagePart,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";
import { Spark } from "./Spark";
import { Composer } from "./Composer";
import { Hero } from "./Hero";
import { ResultBlock } from "./ResultBlock";
import { ResultLoading } from "./ResultLoading";
import { Prose } from "./Prose";
import { ToolPartTracker } from "./ToolPartTracker";
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
      <div className="msg-avatar msg-avatar-user">U</div>
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
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  // ResultBlock until the products arrived.
  const hasUnresolvedProductCall = toolParts.some(
    (t) =>
      [
        "search_products",
        "browse_category",
        "get_product_by_slug",
        "get_product_by_id",
      ].includes(t.toolName) && (t as { result?: unknown }).result === undefined,
  );

  // Decide what to render in the body
  const showLoading = isRunning && hasUnresolvedProductCall;
  const showResultBlock = toolParts.length > 0 && !showLoading;

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
          <ResultBlock toolParts={toolParts as never} text={text} />
        )}

        {!showLoading && !showResultBlock && text && (
          <div className="msg-text">
            <Prose>{text}</Prose>
          </div>
        )}

        {isRunning && !showLoading && !text && toolParts.length === 0 && (
          <ThinkingDots />
        )}
      </div>
    </MessagePrimitive.Root>
  );
}

function ThinkingDots() {
  const { t } = useLocale();
  return (
    <div className="thinking">
      <span className="dot-anim" />
      <span className="dot-anim" />
      <span className="dot-anim" />
      <span style={{ marginLeft: 4 }}>{t("loading.thinking")}</span>
    </div>
  );
}
