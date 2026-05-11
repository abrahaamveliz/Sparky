import type { Product } from "./extract-products";

export type PickReason =
  | "cheapest"
  | "preferred-brand"
  | "diet-match"
  | "smallest-pack";

/** A locale-agnostic explanation key. The UI maps this to a translated
 *  string via `t("result.why." + whyKey, { price })`. */
export type WhyKey =
  | "shelf_correct"
  | "shelf_dominant"
  | "cat_match"
  | "name_match"
  | "fallback";

/** Optional explanation for why the picker had to substitute the user's
 *  ideal product. Rendered below the WHY chip as a SubstitutionRow. */
export type Substitution =
  | {
      kind: "diet-exclusion";
      /** Name of one product that was filtered out, useful for prose like
       *  "Sustituyendo Pepperoni por Salami". */
      droppedExample: string;
    }
  | {
      kind: "preferred-brand-unavailable";
      /** The brands the user prefers, none of which appeared in the
       *  eligible set for this section. */
      preferred: string[];
    };

export type Pick = {
  product: Product;
  /** Translation key for the explanation chip. */
  whyKey: WhyKey;
  reason: PickReason;
  alternates: Product[];
  /** Set when the picker had to swap the user's ideal pick for a
   *  reasoning the UI can surface. */
  substitution?: Substitution;
};

export type SectionContext = {
  /** The search query string for this section. Used for primary-noun
   *  scoring against product names. */
  query?: string;
  /** User's preferred brand names (uppercase). Soft +60 boost when a
   *  product's brand matches. */
  preferredBrands?: string[];
  /** Hard-drop blocklist of substrings (case-insensitive). Products whose
   *  name contains any of these tokens are filtered out before scoring.
   *  Built upstream from dietary flags (e.g., no-pork → ["pepperoni",
   *  "tocino", "jamón", "cerdo"]). */
  dietBlocklist?: string[];
};

/* ─────────────── normalization helpers ─────────────── */

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "para", "con",
  "y", "o", "en", "al", "por", "a",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 /]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(s: string): string[] {
  return normalize(s)
    .replace(/\//g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Top-level shelf for a VTEX category path like "/Frutas y Verduras/Verduras/Apio/" */
function topShelf(categoryPath: string): string {
  const norm = normalize(categoryPath);
  const segs = norm.split("/").filter(Boolean);
  return segs[0] ?? "";
}

/** Compute the dominant top-level shelf among a set of products. The
 *  dominant shelf is the most common first-segment of any product's
 *  category path. Ties broken by length of supporters then alphabetical. */
function dominantShelf(products: Product[]): string | null {
  const counts = new Map<string, number>();
  for (const p of products) {
    const shelves = new Set<string>();
    for (const c of p.categories) {
      const s = topShelf(c);
      if (s) shelves.add(s);
    }
    for (const s of shelves) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  // Require the leader to clearly dominate (>= 40% of the field) so a noisy
  // section doesn't lock onto a wrong shelf.
  const total = products.length;
  if (sorted[0][1] / total < 0.4) return null;
  return sorted[0][0];
}

/** True when at least one of the product's category paths starts with the
 *  given top-level shelf. */
function inShelf(product: Product, shelf: string): boolean {
  for (const c of product.categories) {
    if (topShelf(c) === shelf) return true;
  }
  return false;
}

/** Whether two normalized words are a soft match (equal, prefix, plural
 *  variant, or long-shared head). Handles Spanish/English plurals
 *  (singular ≈ plural+s/es) and prefix matches like "celular" ≈ "celulares". */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  // Plural tolerance: trim trailing s/es from each
  const aSing = a.endsWith("es") ? a.slice(0, -2) : a.endsWith("s") ? a.slice(0, -1) : a;
  const bSing = b.endsWith("es") ? b.slice(0, -2) : b.endsWith("s") ? b.slice(0, -1) : b;
  if (aSing === bSing) return true;
  if (aSing.length >= 3 && bSing.length >= 3) {
    if (aSing.startsWith(bSing) || bSing.startsWith(aSing)) return true;
    if (aSing.length >= 5 && bSing.length >= 5 && aSing.slice(0, 5) === bSing.slice(0, 5))
      return true;
  }
  return false;
}

/** Words that signal user intent (action / comparator) rather than the
 *  product itself. Stripped before extracting product descriptors so
 *  e.g. "compara los celulares más baratos" reduces to ["celular"]. */
const INTENT_WORD_PATTERN =
  /\b(compara|compare|comparo|comparar|busco|buscar|busca|quiero|necesito|find|want|need|show|muestrame|muestra|dame|hay|search|mejor|mejores|best|peor|peores|barato|barata|baratos|baratas|cheap|cheapest|caro|cara|caros|caras|expensive|alto|alta|altos|altas|grande|grandes|small|big|nuevo|nueva|nuevos|nuevas|new|disponible|disponibles|available|tienes|tengo|version|versión|opcion|opciones|option|options|para|recommend|recomienda|recomendar|sugiere|suggest|opciones)\b/gi;

/** Words that contextualize specs ("8GB RAM" → "RAM" is a unit-context
 *  word, not a product type). Stripped so the head doesn't lock onto them. */
const SPEC_CONTEXT_PATTERN =
  /\b(ram|ssd|hdd|cpu|gpu|almacenamiento|memoria|capacidad|peso|tamano|tamaño|talla|size|color|colors|colour)\b/gi;

/** Extract the user-typed product DESCRIPTOR words from a query. Strips
 *  numeric specs, spec-context words, intent/comparator words, then
 *  normalizes and removes stopwords. The remaining tokens are the
 *  discriminators the user typed deliberately — every product the picker
 *  considers MUST contain all of them. */
function queryDescriptors(query: string): string[] {
  const stripped = query
    .toLowerCase()
    .replace(SPEC_PATTERN, " ")
    .replace(SPEC_CONTEXT_PATTERN, " ")
    .replace(INTENT_WORD_PATTERN, " ");
  return contentWords(stripped);
}

/** True when EVERY descriptor word appears (with plural/prefix tolerance)
 *  somewhere in the product name. This is the core relevance gate. */
function nameContainsAll(productName: string, descriptors: string[]): boolean {
  if (descriptors.length === 0) return true;
  const nameWords = contentWords(productName);
  return descriptors.every((d) => nameWords.some((nw) => wordsMatch(nw, d)));
}

/** True when the head descriptor (first product-noun typed) lands in the
 *  first ~3 words of the product name — protects against products that
 *  *mention* the noun in a modifier position (e.g. "Sopa con harina"). */
function headInPrimaryPosition(productName: string, head: string): boolean {
  const nameFirst3 = contentWords(productName).slice(0, 3);
  return nameFirst3.some((nw) => wordsMatch(nw, head));
}

/** Numeric-spec pattern. Matches things like "8GB", "256 GB", "5G", "4K",
 *  "65 pulgadas", "55 inch", "1080p", "12mp", "5000mAh", "120hz".
 *  Captures: 1=value, 2=unit. */
const SPEC_PATTERN = /\b(\d+)\s?(gb|tb|mb|hz|k|p|pulgadas|inch|inches|mp|w|mah|cc|ml|kg|g|l)\b/gi;

type Spec = { value: number; unit: string };

/** Extract numeric specs from a query like "celular 8GB RAM 256gb". */
function extractSpecs(query: string): Spec[] {
  const out: Spec[] = [];
  const seen = new Set<string>();
  for (const m of query.toLowerCase().matchAll(SPEC_PATTERN)) {
    const value = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    if (!Number.isFinite(value)) continue;
    const key = `${value}${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value, unit });
  }
  return out;
}

/** True when the product's name contains every spec from the query.
 *  Tolerant to spacing: "8gb", "8 gb", "8GB" all match. */
function matchesSpecs(productName: string, specs: Spec[]): boolean {
  if (specs.length === 0) return true;
  const name = productName.toLowerCase();
  return specs.every((s) => {
    const re = new RegExp(`\\b${s.value}\\s?${s.unit}\\b`, "i");
    return re.test(name);
  });
}

/** Reward when the query content word appears anywhere in the product's
 *  category leaves AS A WHOLE WORD (with plural tolerance via wordsMatch).
 *  Reason: the previous looser test allowed `cw.includes(qw.slice(0, 5))`,
 *  so query "crema" matched "descremada" via substring and produced
 *  embarrassing "Recomendado" picks (see pickFromSection bug fix below).
 *  Whole-word + plural is the correct strictness for this path. */
function categoryWordMatch(product: Product, query: string): boolean {
  const qWords = contentWords(query);
  if (qWords.length === 0) return false;
  for (const c of product.categories) {
    const cwords = contentWords(c);
    for (const qw of qWords) {
      for (const cw of cwords) {
        if (wordsMatch(cw, qw)) return true;
      }
    }
  }
  return false;
}

/* ─────────────── public entry point ─────────────── */

/**
 * Pick a single best product from a section of search results.
 *
 * Fully general: no keyword blocklists. Relevance comes from the catalog's
 * own taxonomy. Scoring (higher wins):
 *   +200  product is on the section's dominant top-level shelf
 *   +120  query word appears in the product's category path leaves
 *   + 80  query word is the primary noun in the product name
 *   - sellingPrice * 0.5   (price tiebreaker — cheaper wins on ties)
 *
 * Hard requirements: sellingPrice > 0 and a SKU on the product (otherwise
 * cart-add fails). If everything ties to zero score, falls back to the
 * cheapest eligible product.
 */
export function pickFromSection(
  products: Product[],
  ctx: SectionContext = {},
): Pick | null {
  const baseEligible = products.filter(
    (p) => p.sellingPrice > 0 && p.skus[0]?.itemId,
  );
  if (baseEligible.length === 0) return null;

  const query = ctx.query ?? "";

  // HARD-FILTER 0: dietary block. If the user has dietary constraints,
  // products whose name contains any blocked substring are dropped. We
  // do NOT fall back when this empties — diet violations should never
  // surface, even at the cost of an empty section.
  const blocklist = ctx.dietBlocklist ?? [];
  const afterDiet =
    blocklist.length > 0
      ? baseEligible.filter((p) => {
          const n = p.name.toLowerCase();
          return !blocklist.some((b) => n.includes(b.toLowerCase()));
        })
      : baseEligible;
  if (afterDiet.length === 0) return null;

  // HARD-FILTER 1: numeric specs from the query (e.g., "8GB", "256GB",
  // "5G", "65 pulgadas"). If no product matches all specs, fall back to
  // the unfiltered set — empty UI is worse than an off-spec pick.
  const specs = extractSpecs(query);
  const specMatched =
    specs.length > 0
      ? afterDiet.filter((p) => matchesSpecs(p.name, specs))
      : afterDiet;
  const afterSpec = specMatched.length > 0 ? specMatched : afterDiet;

  // HARD-FILTER 2: descriptor containment. EVERY product-descriptor word
  // the user typed (after stripping specs, spec-context words, and
  // intent/comparator words) must appear in the product name. This is the
  // general rule that catches "harina de trigo" → drops corn-flour
  // products, "celular 8GB RAM" → drops RAM sticks, "queso mozzarella" →
  // drops cheddar, etc. The first descriptor must also land in primary
  // position (first 3 words of name) so the product IS the noun, not just
  // mentions it.
  const descriptors = queryDescriptors(query);
  const head = descriptors[0] ?? null;
  const rest = descriptors.slice(1);
  const descriptorMatched =
    descriptors.length > 0
      ? afterSpec.filter(
          (p) =>
            headInPrimaryPosition(p.name, head!) &&
            nameContainsAll(p.name, rest),
        )
      : afterSpec;
  // If the strict filter empties the field, relax: drop the primary-
  // position requirement but still require all descriptors to be present.
  const relaxed =
    descriptorMatched.length === 0 && descriptors.length > 0
      ? afterSpec.filter((p) => nameContainsAll(p.name, descriptors))
      : descriptorMatched;

  // RELEVANCE GATE: if the user typed real descriptor nouns AND not a single
  // returned product's name contains them (even after the relaxed pass),
  // refuse to nominate a "Recomendado". The catalog's full-text index can
  // match substrings (e.g. "crema" inside "desCREMAda"), which previously
  // surfaced an embarrassing confident pick. Returning null here lets the
  // section render the cards without a recommendation chip; ResultBlock
  // shows a low-confidence caveat in that case.
  if (descriptors.length > 0 && relaxed.length === 0) return null;

  const eligible = relaxed.length > 0 ? relaxed : afterSpec;

  const shelf = dominantShelf(eligible);

  type Scored = {
    product: Product;
    score: number;
    onShelf: boolean;
    catMatch: boolean;
    nameMatch: boolean;
    brandMatch: boolean;
  };

  const preferredBrands = (ctx.preferredBrands ?? []).map((b) =>
    b.toUpperCase(),
  );

  const scored: Scored[] = eligible.map((p) => {
    const onShelf = !!shelf && inShelf(p, shelf);
    const catMatch = !!query && categoryWordMatch(p, query);
    const nameMatch = !!head && headInPrimaryPosition(p.name, head);
    const brandMatch =
      preferredBrands.length > 0 &&
      preferredBrands.includes((p.brand ?? "").toUpperCase());
    let score = 0;
    if (onShelf) score += 200;
    if (catMatch) score += 120;
    if (nameMatch) score += 80;
    if (brandMatch) score += 60;
    score -= p.sellingPrice * 0.5;
    return { product: p, score, onShelf, catMatch, nameMatch, brandMatch };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  // The strongest signal that fired determines the WHY key. The UI
  // localizes via `t("result.why." + whyKey, { price })`.
  let whyKey: WhyKey;
  if (top.onShelf && top.catMatch) whyKey = "shelf_correct";
  else if (top.onShelf) whyKey = "shelf_dominant";
  else if (top.catMatch) whyKey = "cat_match";
  else if (top.nameMatch) whyKey = "name_match";
  else whyKey = "fallback";

  // Detect substitutions:
  //  - diet exclusion: at least one product was filtered out by the diet
  //    blocklist (and the user provided diet flags)
  //  - preferred-brand unavailable: user has preferred brands set, but
  //    none of the eligible products matched (the chosen pick is from a
  //    different brand)
  let substitution: Substitution | undefined;
  if (blocklist.length > 0 && afterDiet.length < baseEligible.length) {
    const dropped = baseEligible.find(
      (p) =>
        !afterDiet.includes(p) &&
        blocklist.some((b) => p.name.toLowerCase().includes(b.toLowerCase())),
    );
    if (dropped) {
      substitution = {
        kind: "diet-exclusion",
        droppedExample: dropped.name,
      };
    }
  }
  if (
    !substitution &&
    preferredBrands.length > 0 &&
    !scored.some((s) => s.brandMatch)
  ) {
    substitution = {
      kind: "preferred-brand-unavailable",
      preferred: preferredBrands,
    };
  }

  return {
    product: top.product,
    reason: "cheapest",
    whyKey,
    alternates: scored.slice(1, 3).map((s) => s.product),
    substitution,
  };
}
