import { useEffect, useMemo, useState } from "react";
import { ThreadPrimitive } from "@assistant-ui/react";
import {
  extractProducts,
  countOmittedNoPrice,
  type Product,
} from "@/lib/extract-products";
import { formatGTQ } from "@/lib/format";
import { pickFromSection, type Pick } from "@/lib/decision-engine";
import { useLocale } from "@/lib/i18n";
import { usePreferences, type Diet } from "@/lib/preferences-store";

/** Map dietary flags to substring blocklists. Substring match runs against
 *  product name (case-insensitive). Conservative — adding more terms is
 *  better than missing a violation. */
const DIET_BLOCKLISTS: Record<Diet, string[]> = {
  vegetarian: [
    "carne",
    "pollo",
    "cerdo",
    "res",
    "tocino",
    "jamón",
    "jamon",
    "salchicha",
    "chorizo",
    "pepperoni",
    "salami",
    "embutido",
    "pescado",
    "atún",
    "atun",
    "camarón",
    "camaron",
    "mariscos",
  ],
  vegan: [
    "carne",
    "pollo",
    "cerdo",
    "res",
    "tocino",
    "jamón",
    "jamon",
    "salchicha",
    "chorizo",
    "pepperoni",
    "salami",
    "embutido",
    "pescado",
    "atún",
    "atun",
    "camarón",
    "camaron",
    "mariscos",
    "leche",
    "queso",
    "yogurt",
    "yoghurt",
    "mantequilla",
    "huevo",
    "huevos",
    "miel",
  ],
  "gluten-free": [
    "trigo",
    "harina de trigo",
    "pan",
    "galleta",
    "galletas",
    "pasta",
    "espagueti",
    "tallarin",
    "tallarín",
    "fideo",
    "fideos",
    "cebada",
    "centeno",
    "avena",
  ],
  "lactose-free": [
    "leche",
    "queso",
    "yogurt",
    "yoghurt",
    "crema",
    "mantequilla",
  ],
  "no-pork": ["cerdo", "tocino", "jamón", "jamon", "pepperoni", "chorizo"],
  keto: [
    "azúcar",
    "azucar",
    "harina",
    "pan",
    "galleta",
    "galletas",
    "pasta",
    "arroz",
    "tortilla",
    "miel",
    "jugo",
  ],
};

function buildDietBlocklist(diet: Diet[]): string[] {
  const set = new Set<string>();
  for (const d of diet) {
    for (const term of DIET_BLOCKLISTS[d] ?? []) set.add(term);
  }
  return [...set];
}
import { ProductCard } from "./ProductCard";
import { CompareTable } from "./CompareTable";
import { DetailPane } from "./DetailPane";
import { Prose } from "./Prose";
import { HScrollGrid } from "./HScrollGrid";
import { SubstitutionRow } from "./SubstitutionRow";

type Tab = "list" | "compare" | "detail";

type ToolPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
};

type Section = {
  callId: string;
  query: string;
  products: Product[];
  pick: Pick | null;
};

const SECTIONABLE_TOOLS = new Set(["search_products", "browse_category"]);

/** Human-readable section title. For search_products this is the typed
 *  query; for browse_category the slug, prettified ("alimentos-congelados"
 *  → "Alimentos congelados"). */
function sectionTitle(part: ToolPart): string {
  if (typeof part.args.query === "string" && part.args.query.trim()) {
    return part.args.query.trim();
  }
  if (typeof part.args.category_path === "string" && part.args.category_path) {
    const segs = part.args.category_path.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? "Resultados";
    // "alimentos-congelados" / "frutas-y-verduras" → "Alimentos congelados"
    const pretty = last.replace(/-/g, " ").trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }
  if (typeof part.args.categoryId === "string") return part.args.categoryId;
  return "Resultados";
}

/** Query string passed to pickFromSection. Only meaningful when the user
 *  actually typed a product noun via search_products. For browse_category
 *  there's no descriptor to match against — return empty so the
 *  decision-engine's relevance gate is bypassed and the picker just picks
 *  the cheapest valid product on the dominant shelf. */
function sectionMatchQuery(part: ToolPart): string {
  if (typeof part.args.query === "string" && part.args.query.trim()) {
    return part.args.query.trim();
  }
  return "";
}

export function ResultBlock({
  toolParts,
  text,
}: {
  toolParts: ToolPart[];
  text: string | null;
}) {
  const { t } = useLocale();
  const { preferences } = usePreferences();
  const dietBlocklist = useMemo(
    () => buildDietBlocklist(preferences.diet),
    [preferences.diet],
  );

  // Aggregate all products from product-yielding tools in this assistant turn
  const products = useMemo(() => {
    const map = new Map<string, Product>();
    for (const part of toolParts) {
      const list = extractProducts(part.toolName, part.result);
      if (!list) continue;
      for (const p of list) {
        if (!map.has(p.productId)) map.set(p.productId, p);
      }
    }
    return Array.from(map.values());
  }, [toolParts]);

  // Count of products dropped because the catalog returned them without a
  // price. Surface as a caveat under the result head so the discrepancy
  // between "20 found" and "12 shown" is explained instead of mysterious.
  const omittedNoPrice = useMemo(() => {
    let total = 0;
    for (const part of toolParts) {
      total += countOmittedNoPrice(part.toolName, part.result);
    }
    return total;
  }, [toolParts]);

  // Build per-tool-call sections when 2+ product-yielding searches landed.
  // Single-call turns keep the existing flat-grid path.
  const sections = useMemo<Section[] | null>(() => {
    const productCalls = toolParts.filter(
      (p) => SECTIONABLE_TOOLS.has(p.toolName) && p.result,
    );
    if (productCalls.length < 2) return null;
    const out: Section[] = [];
    for (const part of productCalls) {
      const list = extractProducts(part.toolName, part.result);
      if (!list || list.length === 0) continue;
      // Section header: human-readable label.
      // Match query: only the actually-typed product noun. Empty for
      // browse_category so the picker doesn't try to match the slug name
      // ("abarrotes") against product names and clamp every pick to null.
      const headerQuery = sectionTitle(part);
      const matchQuery = sectionMatchQuery(part);
      out.push({
        callId: part.toolCallId,
        query: headerQuery,
        products: list,
        pick: pickFromSection(list, {
          query: matchQuery,
          preferredBrands: preferences.preferredBrands,
          dietBlocklist,
        }),
      });
    }
    return out.length >= 2 ? out : null;
  }, [toolParts, preferences.preferredBrands, dietBlocklist]);

  // In flat mode: cheapest across all products.
  // In section mode: each section's pick is its own cheapest, so the
  // flat-mode tag is unused (per-section tag uses pick.product.productId).
  const cheapestId = useMemo(() => {
    if (sections) return null;
    if (products.length < 2) return null;
    return products.reduce((b, p) => (p.sellingPrice < b.sellingPrice ? p : b))
      .productId;
  }, [products, sections]);

  // Low-confidence detection — single-search mode only. Two trigger
  // conditions:
  //   (a) the decision engine ran and ended up at whyKey="fallback"
  //       (returned products, but nothing matched shelf/category/noun);
  //   (b) the relevance gate clamped pick to null (returned products,
  //       but NONE of their names contain the user's primary noun as a
  //       whole word — e.g. "pañales 8 meses" landing only a biberón).
  // Both shapes mean "results don't match user intent" and the banner
  // tells the user honestly so the UI doesn't look confidently wrong.
  const lowConfidence = useMemo(() => {
    if (sections) return false;
    if (products.length === 0) return false;
    const part = toolParts.find(
      (p) =>
        SECTIONABLE_TOOLS.has(p.toolName) &&
        p.result &&
        typeof p.args.query === "string",
    );
    if (!part) return false;
    const pick = pickFromSection(products, {
      query: part.args.query as string,
      preferredBrands: preferences.preferredBrands,
      dietBlocklist,
    });
    return pick === null || pick.whyKey === "fallback";
  }, [products, toolParts, sections, preferences.preferredBrands, dietBlocklist]);

  // Original query string the user (effectively) searched, for
  // deterministic banner copy when the agent's prose is suppressed.
  const userQuery = useMemo(() => {
    const part = toolParts.find(
      (p) =>
        SECTIONABLE_TOOLS.has(p.toolName) &&
        typeof p.args.query === "string" &&
        (p.args.query as string).trim(),
    );
    return part ? (part.args.query as string).trim() : "";
  }, [toolParts]);

  // Deterministic prose-suppression. The agent's prose CANNOT be trusted
  // when (a) the relevance gate said "no match" but products exist, or
  // (b) products are empty but the prose claims products exist (forbidden
  // phrases like "Aquí están…" / "Here are…"). In either case we swap
  // the agent's prose for safe copy the user sees no matter what the
  // model emits. This is the production-grade invariant: the UI is the
  // source of truth, not the LLM.
  const proseClaimsProducts = useMemo(() => {
    if (!text) return false;
    const t = text.toLowerCase();
    return (
      /\baquí\s+(est[áa]n|tienes|hay|te dejo)\b/.test(t) ||
      /\bestos\s+son\s+los\b/.test(t) ||
      /\bencontr[ée]\s+(estos|los siguientes|varios)\b/.test(t) ||
      /\bhere\s+(are|you go|you have)\b/.test(t) ||
      /\bthese\s+are\s+the\b/.test(t) ||
      /\byou'?ll\s+find\b/.test(t) ||
      /\bi\s+found\s+(these|the following)\b/.test(t) ||
      /\btap\s+\*?\*?\s*\+\s*add\b/.test(t) ||
      /\btoca\s+\*?\*?\s*\+\s*agregar\b/.test(t)
    );
  }, [text]);
  const suppressAgentProse =
    !sections &&
    ((lowConfidence && proseClaimsProducts) ||
      (products.length === 0 && proseClaimsProducts));

  const [tab, setTab] = useState<Tab>("list");
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Product | null>(null);

  const compareProducts = useMemo(
    () => products.filter((p) => compareSet.has(p.productId)),
    [products, compareSet],
  );

  const toggleCompare = (p: Product) => {
    const has = compareSet.has(p.productId);
    if (has) {
      setCompareSet((prev) => {
        const next = new Set(prev);
        next.delete(p.productId);
        return next;
      });
    } else if (compareSet.size < 4) {
      setCompareSet((prev) => {
        const next = new Set(prev);
        next.add(p.productId);
        return next;
      });
      // Jump straight to the compare view so the user sees what they pinned.
      setTab("compare");
    }
  };

  const removeCompare = (productId: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
    if (compareSet.size - 1 < 2) setTab("list");
  };

  const openDetail = (p: Product) => {
    setDetail(p);
    setTab("detail");
  };

  // If user removed all compare products, fall back to list
  useEffect(() => {
    if (tab === "compare" && compareSet.size < 1) setTab("list");
  }, [compareSet, tab]);

  // Derive query string from the first product-yielding tool call's args
  const querySummary = useMemo(() => {
    for (const part of toolParts) {
      if (part.toolName === "search_products" && typeof part.args.query === "string") {
        return part.args.query;
      }
      if (
        part.toolName === "browse_category" &&
        typeof part.args.category_path === "string"
      ) {
        return part.args.category_path;
      }
    }
    return null;
  }, [toolParts]);

  // If a get_product_by_slug tool ran, auto-focus that product on first render
  useEffect(() => {
    const detailPart = toolParts.find(
      (t) =>
        (t.toolName === "get_product_by_slug" ||
          t.toolName === "get_product_by_id") &&
        t.result,
    );
    if (detailPart && !detail) {
      const list = extractProducts(detailPart.toolName, detailPart.result);
      if (list && list[0]) setDetail(list[0]);
    }
  }, [toolParts, detail]);

  // Followup chips. Prefer chips Wally emitted via the propose_followups
  // client tool (always context-specific, in the user's locale). Fall back
  // to the deterministic derivation when the tool wasn't called.
  const aiFollowups = useMemo<Followup[] | null>(() => {
    const part = toolParts.find((p) => p.toolName === "propose_followups");
    if (!part) return null;
    const list = (part.args?.suggestions ?? []) as {
      label?: string;
      prompt?: string;
    }[];
    const cleaned = list
      .filter((s) => typeof s.label === "string" && typeof s.prompt === "string")
      .map((s) => ({ label: s.label!, prompt: s.prompt! }));
    return cleaned.length > 0 ? cleaned : null;
  }, [toolParts]);

  const followups = useMemo(() => {
    if (aiFollowups) return aiFollowups;
    return sections ? [] : deriveFollowups(toolParts, products, t);
  }, [aiFollowups, toolParts, products, sections, t]);

  // If there are no products and no text, render nothing visible (the parent
  // will be showing a loading or empty state).
  if (products.length === 0 && !text && toolParts.length === 0) return null;

  // True when a search-style tool ran but returned 0 products (vs a
  // non-product turn like list_categories).
  const ranEmptySearch = toolParts.some(
    (p) =>
      SECTIONABLE_TOOLS.has(p.toolName) &&
      (p as { result?: unknown }).result !== undefined,
  );

  // For non-product results (e.g. list_categories only), fall back to a simple
  // prose-only block. When a search ran and returned nothing, render an
  // explicit empty-state notice above the prose.
  if (products.length === 0) {
    return (
      <div className="result">
        <div className="result-body">
          {ranEmptySearch && (
            <div className="empty-state">
              <span className="empty-state-icon">🔍</span>
              <div className="empty-state-text">
                <strong>{t("result.empty.title")}</strong>
                <span>{t("result.empty.body")}</span>
              </div>
            </div>
          )}
          {text && !suppressAgentProse && (
            <div className="result-prose">
              <Prose>{text}</Prose>
            </div>
          )}
          {suppressAgentProse && (
            <div className="result-prose result-prose--safe">
              <p>
                {userQuery
                  ? t("result.safe.empty_for_query", { q: userQuery })
                  : t("result.safe.empty_generic")}
              </p>
            </div>
          )}
          {followups.length > 0 && (
            <div className="result-followups">
              <span className="followup-label">{t("result.followups.label")}</span>
              {followups.map((f) => (
                <ThreadPrimitive.Suggestion
                  key={f.label}
                  prompt={f.prompt}
                  method="replace"
                  autoSend
                  asChild
                >
                  <button type="button" className="chip-btn">
                    {f.label}
                  </button>
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalCount = sections
    ? sections.reduce((s, x) => s + x.products.length, 0)
    : products.length;

  return (
    <div className="result">
      <div className="result-head">
        <div className="result-head-text">
          <span className="result-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <span className="result-summary">
            <strong>{t("result.results", { n: totalCount })}</strong>
            {sections ? (
              <span className="result-summary-q">
                {" "}
                {t("result.in_sections", { n: sections.length })}
              </span>
            ) : (
              querySummary && (
                <span className="result-summary-q">
                  {" "}
                  {t("result.for_query", { q: querySummary })}
                </span>
              )
            )}
            {omittedNoPrice > 0 && (
              <span className="result-summary-omitted">
                {" · "}
                {t("result.omitted_no_price", { n: omittedNoPrice })}
              </span>
            )}
          </span>
        </div>
        <div className="result-head-tabs" role="tablist">
          <button
            type="button"
            className={`rtab${tab === "list" ? " active" : ""}`}
            onClick={() => setTab("list")}
            role="tab"
            aria-selected={tab === "list"}
          >
            {t("result.tab.products")} <span className="rtab-count">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`rtab${tab === "compare" ? " active" : ""}${compareSet.size < 1 ? " disabled" : ""}`}
            onClick={() => compareSet.size >= 1 && setTab("compare")}
            disabled={compareSet.size < 1}
            role="tab"
            aria-selected={tab === "compare"}
          >
            {t("result.tab.compare")}
            <span
              className={`rtab-count${compareSet.size > 0 ? " rtab-count-yellow" : ""}`}
            >
              {compareSet.size}
            </span>
          </button>
          <button
            type="button"
            className={`rtab${tab === "detail" ? " active" : ""}${!detail ? " disabled" : ""}`}
            onClick={() => detail && setTab("detail")}
            disabled={!detail}
            role="tab"
            aria-selected={tab === "detail"}
          >
            {t("result.tab.detail")} {detail && <span className="rtab-dot" />}
          </button>
        </div>
      </div>

      <div className="result-body">
        {tab === "list" && (
          <>
            {sections ? (
              <>
                <div className="plan-preamble">
                  <span className="plan-preamble-label">
                    {t("result.plan_label")}
                  </span>
                  <span className="plan-preamble-list">
                    {sections.map((s, i) => (
                      <span key={s.callId} className="plan-preamble-item">
                        {s.query}
                        {i < sections.length - 1 && (
                          <span className="plan-preamble-sep">·</span>
                        )}
                      </span>
                    ))}
                  </span>
                </div>

                {text && (
                  <div className="result-prose">
                    <Prose>{text}</Prose>
                  </div>
                )}

                <div className="result-sections">
                  {sections.map((s) => (
                    <section key={s.callId} className="result-section">
                      <header className="result-section-head">
                        <span className="result-section-title">{s.query}</span>
                        <span className="result-section-count">
                          {t("result.section.results", { n: s.products.length })}
                        </span>
                      </header>
                      {s.pick ? (
                        <>
                          <div className="why-chip">
                            <span className="why-chip-check">✓</span>
                            <span className="why-chip-label">
                              {t("result.recommended")}
                            </span>
                            <strong className="why-chip-name">
                              {s.pick.product.name}
                            </strong>
                            <span className="why-chip-why">
                              {t(`result.why.${s.pick.whyKey}`, {
                                price: formatGTQ(s.pick.product.sellingPrice),
                              })}
                            </span>
                          </div>
                          {s.pick.substitution && (
                            <SubstitutionRow
                              substitution={s.pick.substitution}
                              chosenName={s.pick.product.name}
                            />
                          )}
                        </>
                      ) : (
                        s.products.length > 0 && (
                          <div className="result-section-caveat" role="note">
                            <strong>{t("result.low_confidence.title")}</strong>
                            <span>{t("result.low_confidence.body")}</span>
                          </div>
                        )
                      )}
                      <HScrollGrid>
                        {s.products.map((p) => (
                          <ProductCard
                            key={p.productId}
                            product={p}
                            compared={compareSet.has(p.productId)}
                            pinned={false}
                            tag={
                              s.pick && p.productId === s.pick.product.productId
                                ? "cheap"
                                : null
                            }
                            onCompare={toggleCompare}
                            onDetail={openDetail}
                          />
                        ))}
                      </HScrollGrid>
                    </section>
                  ))}
                </div>

                {aiFollowups && aiFollowups.length > 0 && (
                  <div className="result-followups">
                    <span className="followup-label">
                      {t("result.followups.label")}
                    </span>
                    {aiFollowups.map((f) => (
                      <ThreadPrimitive.Suggestion
                        key={f.label}
                        prompt={f.prompt}
                        method="replace"
                        autoSend
                        asChild
                      >
                        <button type="button" className="chip-btn">
                          {f.label}
                        </button>
                      </ThreadPrimitive.Suggestion>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {text && !suppressAgentProse && (
                  <div className="result-prose">
                    <Prose>{text}</Prose>
                  </div>
                )}
                {suppressAgentProse && (
                  <div className="result-prose result-prose--safe">
                    <p>
                      {userQuery
                        ? t("result.safe.mismatch_for_query", { q: userQuery })
                        : t("result.safe.mismatch_generic")}
                    </p>
                  </div>
                )}
                {lowConfidence && (
                  <div className="low-confidence-banner">
                    <span className="low-confidence-icon">!</span>
                    <div className="low-confidence-text">
                      <strong>{t("result.low_confidence.title")}</strong>
                      <span>{t("result.low_confidence.body")}</span>
                    </div>
                  </div>
                )}
                <HScrollGrid>
                  {products.map((p) => (
                    <ProductCard
                      key={p.productId}
                      product={p}
                      compared={compareSet.has(p.productId)}
                      pinned={false}
                      tag={p.productId === cheapestId ? "cheap" : null}
                      onCompare={toggleCompare}
                      onDetail={openDetail}
                    />
                  ))}
                </HScrollGrid>
                {followups.length > 0 && (
                  <div className="result-followups">
                    <span className="followup-label">{t("result.followups.label")}</span>
                    {followups.map((f) => {
                      if (f.action === "compare-top-3") {
                        return (
                          <button
                            key={f.label}
                            type="button"
                            className="chip-btn"
                            onClick={() => {
                              setCompareSet(
                                new Set(products.slice(0, 3).map((p) => p.productId)),
                              );
                              setTab("compare");
                            }}
                          >
                            {f.label}
                          </button>
                        );
                      }
                      return (
                        <ThreadPrimitive.Suggestion
                          key={f.label}
                          prompt={f.prompt}
                          method="replace"
                          autoSend
                          asChild
                        >
                          <button type="button" className="chip-btn">
                            {f.label}
                          </button>
                        </ThreadPrimitive.Suggestion>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "compare" && (
          <CompareTable
            products={compareProducts}
            allProducts={products}
            onRemove={removeCompare}
            onAdd={toggleCompare}
          />
        )}

        {tab === "detail" && detail && (
          <DetailPane
            product={detail}
            onBack={() => setTab("list")}
            onCompare={toggleCompare}
            compared={compareSet.has(detail.productId)}
          />
        )}
      </div>
    </div>
  );
}

type Followup = { label: string; prompt: string; action?: "compare-top-3" };
type T = (key: string, params?: Record<string, string | number>) => string;

function deriveFollowups(
  toolParts: ToolPart[],
  products: Product[],
  t: T,
): Followup[] {
  for (let i = toolParts.length - 1; i >= 0; i--) {
    const part = toolParts[i];
    const name = part.toolName;
    if (name === "search_products" || name === "browse_category") {
      // Prompts to Wally always go in Spanish (catalog language). Labels
      // shown to the user are localized via t().
      const chips: Followup[] = [
        {
          label: t("result.followups.sort_price"),
          prompt: "Ordena por precio más barato primero.",
        },
      ];
      const brandCount = new Map<string, number>();
      for (const p of products) {
        if (!p.brand) continue;
        brandCount.set(p.brand, (brandCount.get(p.brand) ?? 0) + 1);
      }
      const topBrand = [...brandCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topBrand) {
        chips.push({
          label: t("result.followups.only_brand", { brand: topBrand }),
          prompt: `Filtra solo productos de la marca ${topBrand}.`,
        });
      }
      const prices = products
        .map((p) => p.sellingPrice)
        .filter((n) => typeof n === "number" && n > 0)
        .sort((a, b) => a - b);
      if (prices.length) {
        const median = prices[Math.floor(prices.length / 2)];
        const cap = Math.max(10, Math.round(median));
        chips.push({
          label: t("result.followups.under_price", { price: formatGTQ(cap) }),
          prompt: `Solo productos bajo Q${cap}.`,
        });
      }
      if (products.length >= 3) {
        chips.push({
          label: t("result.followups.compare_top3"),
          prompt: "",
          action: "compare-top-3",
        });
      }
      return chips.slice(0, 4);
    }
    if (name === "list_categories") {
      const targets = ["Farmacia", "Lácteos", "Limpieza", "Bebes y Niños"];
      return targets.slice(0, 4).map((cat) => ({
        label: t("result.followups.view_category", { category: cat }),
        prompt: `Muéstrame productos de la categoría ${cat}.`,
      }));
    }
    if (name === "get_product_by_slug" || name === "get_product_by_id") {
      const p = products[0];
      if (!p) return [];
      return [
        {
          label: t("result.followups.find_similar"),
          prompt: `Busca productos similares a "${p.name}".`,
        },
        {
          label: t("result.followups.compare_other_brand"),
          prompt: `Compara "${p.name}" con un similar de otra marca.`,
        },
      ];
    }
  }
  return [];
}
