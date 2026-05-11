export type Product = {
  productId: string;
  name: string;
  brand: string;
  slug: string;
  link: string;
  sellingPrice: number;
  listPrice: number;
  priceWithoutDiscount: number;
  description: string;
  images: { imageUrl: string; imageText?: string }[];
  specifications: { name: string; values: unknown }[];
  categories: string[];
  /** SKUs returned by the MCP. The first SKU's `itemId` is what
   *  /checkout/cart/add expects in the `sku` query param. */
  skus: { itemId: string; name?: string; ean?: string }[];
};

const PRODUCT_TOOLS = new Set([
  "search_products",
  "browse_category",
  "get_product_by_slug",
  "get_product_by_id",
]);

function unwrap(result: unknown): unknown {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const sc = r.structuredContent;
  if (sc === undefined) return result;
  // FastMCP wraps non-dict returns (lists, primitives) in `{ result: ... }`.
  // Dict returns (e.g. search_products) are placed at structuredContent
  // directly. Detect the wrapper form by it being a single-key `{result}`.
  if (
    sc &&
    typeof sc === "object" &&
    !Array.isArray(sc) &&
    "result" in (sc as object) &&
    Object.keys(sc as object).length === 1
  ) {
    return (sc as { result: unknown }).result;
  }
  return sc;
}

function toProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!p.productId || !p.name) return null;
  const images = Array.isArray(p.images)
    ? (p.images as Array<Record<string, unknown>>)
        .filter((i) => typeof i.imageUrl === "string")
        .map((i) => ({
          imageUrl: i.imageUrl as string,
          imageText: typeof i.imageText === "string" ? i.imageText : undefined,
        }))
    : [];
  // VTEX surfaces internal storefront config as specs (names starting with
  // "_", e.g. "_allowlist", "_internal", etc). Strip them so they don't leak
  // into the compare table or detail pane.
  const specs = Array.isArray(p.specifications)
    ? (p.specifications as Array<Record<string, unknown>>)
        .map((s) => ({
          name: String(s.name ?? ""),
          values: s.values,
        }))
        .filter(
          (s) =>
            s.name &&
            !s.name.startsWith("_") &&
            s.name.toLowerCase() !== "allowlist",
        )
    : [];
  return {
    productId: String(p.productId),
    name: String(p.name),
    brand: String(p.brand ?? ""),
    slug: String(p.slug ?? ""),
    link: typeof p.link === "string" ? p.link : "#",
    sellingPrice: typeof p.sellingPrice === "number" ? p.sellingPrice : 0,
    listPrice: typeof p.listPrice === "number" ? p.listPrice : 0,
    priceWithoutDiscount:
      typeof p.priceWithoutDiscount === "number" ? p.priceWithoutDiscount : 0,
    description: typeof p.description === "string" ? p.description : "",
    images,
    specifications: specs,
    categories: Array.isArray(p.categories)
      ? (p.categories as unknown[]).map(String)
      : [],
    skus: Array.isArray(p.skus)
      ? (p.skus as Array<Record<string, unknown>>)
          .filter((s) => typeof s.itemId === "string" || typeof s.itemId === "number")
          .map((s) => ({
            itemId: String(s.itemId),
            name: typeof s.name === "string" ? s.name : undefined,
            ean: typeof s.ean === "string" ? s.ean : undefined,
          }))
      : [],
  };
}

export function extractProducts(
  toolName: string,
  result: unknown,
): Product[] | null {
  if (!PRODUCT_TOOLS.has(toolName)) return null;
  const data = unwrap(result);
  if (!data) return [];

  // search_products / browse_category → { total, products: [...] }
  if (typeof data === "object" && "products" in (data as object)) {
    const list = (data as { products?: unknown[] }).products ?? [];
    return list
      .map(toProduct)
      .filter((p): p is Product => p !== null && p.sellingPrice > 0);
  }

  // get_product_by_slug / get_product_by_id → single product or null
  if (typeof data === "object" && "productId" in (data as object)) {
    const single = toProduct(data);
    return single && single.sellingPrice > 0 ? [single] : [];
  }

  return [];
}

/** Count of items in a tool result that parsed but were dropped because
 *  they had no usable price (sellingPrice <= 0). Used to surface a small
 *  caveat when search returned more rows than the UI shows. */
export function countOmittedNoPrice(
  toolName: string,
  result: unknown,
): number {
  if (!PRODUCT_TOOLS.has(toolName)) return 0;
  const data = unwrap(result);
  if (!data || typeof data !== "object") return 0;
  if ("products" in data) {
    const list = (data as { products?: unknown[] }).products ?? [];
    let omitted = 0;
    for (const raw of list) {
      const p = toProduct(raw);
      if (p && p.sellingPrice <= 0) omitted++;
    }
    return omitted;
  }
  return 0;
}
