import { useEffect, useRef } from "react";
import { useChat, type ChatMessage } from "@/lib/use-chat";
import { useLocale } from "@/lib/i18n";
import { Spark } from "./Spark";
import { Hero } from "./Hero";
import { Prose } from "./Prose";
import { ResultBlock, type ToolPart } from "./ResultBlock";
import { FollowupChips } from "./FollowupChips";
import { ResultLoading } from "./ResultLoading";
import { AGENT_AVATAR_URL } from "@/lib/product-name";

const PRODUCT_TOOLS = new Set([
  "search_products",
  "browse_category",
  "get_product_by_slug",
  "get_product_by_id",
]);

export function Thread() {
  const { messages, isStreaming, error, retry } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="thread-root">
        <div className="stage">
          <Hero />
        </div>
      </div>
    );
  }

  return (
    <div className="thread-root">
      <div className="stage">
        <div className="thread">
          {messages.map((msg, i) => {
            const isLastAssistant =
              msg.role === "assistant" && i === messages.length - 1;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isLastAssistant && isStreaming}
                showThinking={isLastAssistant && isStreaming && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)}
              />
            );
          })}
          {/* Show standalone thinking only when no assistant message exists yet */}
          {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
            <ThinkingBubble />
          )}
          {error && <ErrorTile error={error} onRetry={retry} />}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming = false, showThinking = false }: { message: ChatMessage; isStreaming?: boolean; showThinking?: boolean }) {
  if (message.role === "user") {
    // Strip the [category:... sub:...] routing tag injected by the mega menu
    const displayContent = message.content.replace(/\s*\[category:[^\]]+\]/g, "");
    return (
      <div className="msg msg-user">
        <div className="bubble bubble-user">{displayContent}</div>
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
      </div>
    );
  }

  // Assistant message
  const toolParts = buildToolParts(message);
  const hasProductTools = toolParts.some((tp) => PRODUCT_TOOLS.has(tp.toolName));
  const searchMeta = extractSearchMeta(message);
  const followups = extractFollowups(message);
  const hasText = message.content.trim().length > 0;

  // Check if any product tool calls are still pending (result not yet received)
  const pendingProductToolIds = (message.toolCalls ?? []).filter(
    (tc) =>
      PRODUCT_TOOLS.has(tc.name) &&
      !(message.toolResults ?? []).some((tr) => tr.id === tc.id),
  );
  const hasPendingProductTools = isStreaming && pendingProductToolIds.length > 0;

  // Don't show ResultBlock until ALL product tool calls are resolved
  const showResultBlock = hasProductTools && !hasPendingProductTools;

  // Show skeleton while any product tool call is pending
  const showSkeleton = isStreaming && hasPendingProductTools;

  return (
    <div className="msg msg-assistant">
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
        {showThinking && <ThinkingDots />}
        {showSkeleton && (
          <ResultLoading query={extractQueryFromToolCalls(message)} />
        )}
        {showResultBlock && (
          <ResultBlock
            toolParts={toolParts}
            text={hasText ? message.content : null}
            searchMeta={searchMeta}
          />
        )}
        {/* Standalone prose only when ResultBlock is NOT rendering (it handles its own) */}
        {!hasProductTools && hasText && (
          <div className="msg-text">
            <Prose>{message.content}</Prose>
          </div>
        )}
        {/* Followups for non-product turns (ResultBlock handles its own) */}
        {!hasProductTools && followups.length > 0 && <FollowupChips suggestions={followups} />}
      </div>
    </div>
  );
}

export type SearchMeta = {
  total: number;
  start: number;
  end: number;
  searchParams?: {
    query?: string;
    category?: string;
    category_path?: string;
    brand_id?: number;
    price_min?: number;
    price_max?: number;
    order_by?: string;
  };
};

/** Build the ToolPart[] array that ResultBlock expects from a ChatMessage.
 *  Merges toolCalls with their matching toolResults. Also picks up any
 *  toolResults that have no matching toolCall (defensive — the SSE protocol
 *  guarantees ordering, but localStorage-restored or race-condition
 *  messages might only have results). */
function buildToolParts(msg: ChatMessage): ToolPart[] {
  const parts: ToolPart[] = [];
  const seen = new Set<string>();

  // Primary path: iterate toolCalls, join with matching results
  for (const tc of msg.toolCalls ?? []) {
    seen.add(tc.id);
    const tr = (msg.toolResults ?? []).find((r) => r.id === tc.id);
    parts.push({
      toolCallId: tc.id,
      toolName: tc.name,
      args: tc.input,
      result: tr?.result,
      isError: tr?.is_error,
    });
  }

  // Fallback: pick up any tool results that weren't matched by a toolCall
  for (const tr of msg.toolResults ?? []) {
    if (seen.has(tr.id)) continue;
    parts.push({
      toolCallId: tr.id,
      toolName: tr.name,
      args: {},
      result: tr.result,
      isError: tr.is_error,
    });
  }

  return parts;
}

/** Extract pagination metadata from the primary search tool result. */
function extractSearchMeta(msg: ChatMessage): SearchMeta | undefined {
  if (!msg.toolResults) return undefined;

  // Find the last search/browse tool result with a total count
  for (let i = (msg.toolResults ?? []).length - 1; i >= 0; i--) {
    const tr = msg.toolResults[i];
    if (!PRODUCT_TOOLS.has(tr.name) || tr.is_error) continue;
    const result = tr.result as Record<string, unknown> | null;
    if (!result) continue;
    const total = typeof result.total === "number" ? result.total : 0;
    if (total <= 0) continue;

    // Find the matching tool call to get search params
    const tc = (msg.toolCalls ?? []).find((t) => t.id === tr.id);
    const input = tc?.input ?? {};

    // Don't show pagination in multi-search (recipe) mode
    const searchCount = (msg.toolResults ?? []).filter(
      (r) => PRODUCT_TOOLS.has(r.name) && !r.is_error && r.result,
    ).length;
    if (searchCount > 1) return undefined;

    return {
      total,
      start: typeof result.start === "number" ? result.start : 0,
      end: typeof result.end === "number" ? result.end : 19,
      searchParams: {
        query: typeof input.query === "string" ? input.query : undefined,
        category: typeof input.category === "string" ? input.category : undefined,
        category_path: typeof input.category_path === "string" ? input.category_path : undefined,
        brand_id: typeof input.brand_id === "number" ? input.brand_id : undefined,
        price_min: typeof input.price_min === "number" ? input.price_min : undefined,
        price_max: typeof input.price_max === "number" ? input.price_max : undefined,
        order_by: typeof input.order_by === "string" ? input.order_by : undefined,
      },
    };
  }

  return undefined;
}

function extractFollowups(
  msg: ChatMessage,
): { label: string; prompt: string }[] {
  if (!msg.toolResults) return [];
  for (const tr of msg.toolResults) {
    if (tr.name === "propose_followups" && !tr.is_error) {
      const result = tr.result as Record<string, unknown>;
      if (Array.isArray(result?.suggestions)) {
        return result.suggestions as { label: string; prompt: string }[];
      }
    }
  }
  return [];
}

/** Extract the search query from pending product tool calls for the loading skeleton. */
function extractQueryFromToolCalls(msg: ChatMessage): string | undefined {
  for (const tc of msg.toolCalls ?? []) {
    if (PRODUCT_TOOLS.has(tc.name)) {
      const q = tc.input?.query;
      if (typeof q === "string") return q;
    }
  }
  return undefined;
}


function ThinkingDots() {
  const { t } = useLocale();
  return (
    <div
      className="thinking"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="dot-anim" aria-hidden="true" />
      <span className="dot-anim" aria-hidden="true" />
      <span className="dot-anim" aria-hidden="true" />
      <span style={{ marginLeft: 4 }}>{t("loading.thinking")}</span>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="msg msg-assistant">
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
        <ThinkingDots />
      </div>
    </div>
  );
}

function ErrorTile({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="turn-error" role="alert">
      <div className="turn-error-icon" aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <div className="turn-error-text">
        <strong>{t("turn.error.title")}</strong>
        <span>{error}</span>
      </div>
      <button type="button" className="turn-error-retry" onClick={onRetry}>
        {t("turn.error.retry")}
      </button>
    </div>
  );
}