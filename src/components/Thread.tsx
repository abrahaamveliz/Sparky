import { useEffect, useRef } from "react";
import { useChat, type ChatMessage } from "@/lib/use-chat";
import { useLocale } from "@/lib/i18n";
import { Spark } from "./Spark";
import { Hero } from "./Hero";
import { Prose } from "./Prose";
import { ProductGrid } from "./ProductGrid";
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
  const { products, searchMeta } = extractProductsAndMeta(message);
  const followups = extractFollowups(message);
  const hasProducts = products.length > 0;
  const hasText = message.content.trim().length > 0;

  // Check if any product tool calls are still pending (result not yet received)
  const pendingProductToolIds = (message.toolCalls ?? []).filter(
    (tc) =>
      PRODUCT_TOOLS.has(tc.name) &&
      !(message.toolResults ?? []).some((tr) => tr.id === tc.id),
  );
  const hasPendingProductTools = isStreaming && pendingProductToolIds.length > 0;

  // Don't show products until ALL product tool calls are resolved — prevents
  // the "flash of wrong products" when an early result is from a retry-failed
  // search and will be replaced by the next result.
  const showProducts = hasProducts && !hasPendingProductTools;

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
        {showProducts && <ProductGrid products={products} searchMeta={searchMeta} />}
        {hasText && (
          <div className="msg-text">
            <Prose>{message.content}</Prose>
          </div>
        )}
        {followups.length > 0 && <FollowupChips suggestions={followups} />}
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

function extractProductsAndMeta(msg: ChatMessage): {
  products: Record<string, unknown>[];
  searchMeta?: SearchMeta;
} {
  if (!msg.toolResults) return { products: [] };

  // Collect products per tool call, keeping order
  const perCall: Array<{
    name: string;
    products: Record<string, unknown>[];
    result: Record<string, unknown>;
    toolCallId: string;
  }> = [];

  for (const tr of msg.toolResults) {
    if (!PRODUCT_TOOLS.has(tr.name) || tr.is_error) continue;
    const result = tr.result as Record<string, unknown> | null;
    if (!result) continue;

    const callProducts: Record<string, unknown>[] = [];
    if (Array.isArray((result as any).products)) {
      callProducts.push(...((result as any).products as Record<string, unknown>[]));
    } else if ((result as any).productId) {
      callProducts.push(result);
    }

    // Filter products with valid prices
    const valid = callProducts.filter(
      (p) => typeof (p as any).sellingPrice === "number" && (p as any).sellingPrice > 0,
    );

    if (valid.length > 0) {
      perCall.push({ name: tr.name, products: valid, result, toolCallId: tr.id });
    }
  }

  if (perCall.length === 0) return { products: [] };

  // Build search metadata from the primary tool result + its call input
  function buildMeta(call: typeof perCall[0]): SearchMeta | undefined {
    const r = call.result;
    const total = typeof r.total === "number" ? r.total : 0;
    if (total <= 0) return undefined;

    // Find the matching tool call to get search params
    const tc = (msg.toolCalls ?? []).find((t) => t.id === call.toolCallId);
    const input = tc?.input ?? {};

    return {
      total,
      start: typeof r.start === "number" ? r.start : 0,
      end: typeof r.end === "number" ? r.end : 19,
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

  // For recipe/multi-component plans (multiple search_products calls),
  // show all results. For single browse/retry scenarios, show the last
  // successful search to avoid mixing failed-attempt results with the
  // correct ones.
  if (perCall.length <= 1) {
    return {
      products: perCall[0]?.products ?? [],
      searchMeta: buildMeta(perCall[0]),
    };
  }

  // Heuristic: if all calls are search_products (recipe mode), show all.
  // If there's a mix of browse + search (retry), show only the last call.
  const allSearch = perCall.every((c) => c.name === "search_products");
  if (allSearch) {
    // Deduplicate by productId across all calls
    const seen = new Set<string>();
    const all: Record<string, unknown>[] = [];
    for (const call of perCall) {
      for (const p of call.products) {
        const id = String((p as any).productId);
        if (!seen.has(id)) {
          seen.add(id);
          all.push(p);
        }
      }
    }
    // Recipe mode: don't show pagination (multiple searches combined)
    return { products: all };
  }

  // Mixed calls — show only the last successful one (likely the retry)
  const last = perCall[perCall.length - 1];
  return { products: last.products, searchMeta: buildMeta(last) };
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