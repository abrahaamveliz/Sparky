import { useState, useMemo, useCallback } from "react";
import { ProductCard } from "./ProductCard";
import { CompareTable } from "./CompareTable";
import { DetailPane } from "./DetailPane";
import { HScrollGrid } from "./HScrollGrid";
import { useLocale } from "@/lib/i18n";
import type { Product } from "@/lib/extract-products";
import type { SearchMeta } from "./Thread";

/** Convert a raw tool-result object to the typed Product shape. */
function toProduct(p: Record<string, unknown>): Product {
  return {
    productId: String(p.productId || ""),
    name: String(p.name || ""),
    brand: String(p.brand || ""),
    slug: String(p.slug || ""),
    link: typeof p.link === "string" ? p.link : "#",
    sellingPrice: typeof p.sellingPrice === "number" ? p.sellingPrice : 0,
    listPrice: typeof p.listPrice === "number" ? p.listPrice : 0,
    priceWithoutDiscount:
      typeof p.priceWithoutDiscount === "number"
        ? p.priceWithoutDiscount
        : 0,
    description: typeof p.description === "string" ? p.description : "",
    images: Array.isArray(p.images)
      ? (p.images as Array<Record<string, unknown>>)
          .filter((i) => typeof i.imageUrl === "string")
          .map((i) => ({
            imageUrl: i.imageUrl as string,
            imageText:
              typeof i.imageText === "string" ? i.imageText : undefined,
          }))
      : [],
    specifications: Array.isArray(p.specifications)
      ? (p.specifications as Array<Record<string, unknown>>).map((s) => ({
          name: String(s.name ?? ""),
          values: s.values,
        }))
      : [],
    categories: Array.isArray(p.categories)
      ? (p.categories as unknown[]).map(String)
      : [],
    skus: Array.isArray(p.skus)
      ? (p.skus as Array<Record<string, unknown>>)
          .filter(
            (s) =>
              typeof s.itemId === "string" || typeof s.itemId === "number",
          )
          .map((s) => ({
            itemId: String(s.itemId),
            name: typeof s.name === "string" ? s.name : undefined,
            ean: typeof s.ean === "string" ? s.ean : undefined,
          }))
      : [],
  };
}

/**
 * Renders a grid of product cards from raw tool result data.
 * Supports "load more" pagination for large result sets.
 */
export function ProductGrid({
  products: rawProducts,
  searchMeta,
}: {
  products: Record<string, unknown>[];
  searchMeta?: SearchMeta;
}) {
  const { t } = useLocale();
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [extraProducts, setExtraProducts] = useState<Product[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentEnd, setCurrentEnd] = useState(searchMeta?.end ?? 19);

  // Convert raw objects to Product type
  const initialProducts: Product[] = useMemo(
    () => rawProducts.map(toProduct),
    [rawProducts],
  );

  // Combine initial + paginated products
  const products = useMemo(
    () => [...initialProducts, ...extraProducts],
    [initialProducts, extraProducts],
  );

  const hasMore =
    searchMeta != null &&
    searchMeta.total > products.length &&
    searchMeta.searchParams != null;

  const loadMore = useCallback(async () => {
    if (!searchMeta?.searchParams || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextStart = currentEnd + 1;
      const nextEnd = Math.min(nextStart + 49, searchMeta.total - 1);
      const res = await fetch("/api/products/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...searchMeta.searchParams,
          start: nextStart,
          end: nextEnd,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.products)) {
        const newProducts = data.products
          .map((p: Record<string, unknown>) => toProduct(p))
          .filter((p: Product) => p.sellingPrice > 0);
        // Deduplicate by productId
        const existingIds = new Set(products.map((p) => p.productId));
        const unique = newProducts.filter(
          (p: Product) => !existingIds.has(p.productId),
        );
        setExtraProducts((prev) => [...prev, ...unique]);
        setCurrentEnd(typeof data.end === "number" ? data.end : nextEnd);
      }
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [searchMeta, loadingMore, currentEnd, products]);

  if (products.length === 0) return null;

  function toggleCompare(p: Product) {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(p.productId)) next.delete(p.productId);
      else next.add(p.productId);
      return next;
    });
  }

  const compared = products.filter((p) => compareSet.has(p.productId));

  return (
    <div className="result">
      {compared.length >= 2 && (
        <CompareTable
          products={compared}
          allProducts={products}
          onRemove={(productId: string) => {
            setCompareSet((prev) => {
              const next = new Set(prev);
              next.delete(productId);
              return next;
            });
          }}
          onAdd={toggleCompare}
        />
      )}

      <HScrollGrid>
        {products.map((product) => (
          <ProductCard
            key={product.productId}
            product={product}
            onCompare={toggleCompare}
            onDetail={setDetailProduct}
            compared={compareSet.has(product.productId)}
          />
        ))}
      </HScrollGrid>

      {hasMore && (
        <div className="pgrid-pagination">
          {!loadingMore && (
            <span className="pgrid-count">
              {t("result.showing_count", {
                shown: String(products.length),
                total: String(searchMeta!.total),
              })}
            </span>
          )}
          <button
            type="button"
            className="pgrid-load-more"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore && <span className="spinner-sm" />}
            {loadingMore ? t("result.loading_more") : t("result.load_more")}
          </button>
        </div>
      )}

      {detailProduct && (
        <DetailPane
          product={detailProduct}
          onBack={() => setDetailProduct(null)}
          onCompare={toggleCompare}
          compared={compareSet.has(detailProduct.productId)}
        />
      )}
    </div>
  );
}