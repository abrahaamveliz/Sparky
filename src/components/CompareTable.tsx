import { useMemo } from "react";
import { formatGTQ } from "@/lib/format";
import type { Product } from "@/lib/extract-products";
import { useLocale } from "@/lib/i18n";
import { gradientFor } from "./ProductCard";

type Row =
  | { labelKey: string; render: (p: Product) => string; emphasize?: boolean }
  | {
      labelKey: string;
      key: string;
      render?: never;
      emphasize?: boolean;
    };

const ROWS: Row[] = [
  { labelKey: "compare.col.brand", render: (p) => p.brand || "—" },
  { labelKey: "compare.col.price", render: (p) => formatGTQ(p.sellingPrice), emphasize: true },
];

function specRows(products: Product[]): { label: string; values: string[] }[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    for (const s of p.specifications) {
      if (!s.name || !s.values) continue;
      if (s.name.startsWith("_")) continue;
      if (Array.isArray(s.values) && s.values.length === 0) continue;
      counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    }
  }
  const sharedNames = Array.from(counts.entries())
    .filter(([, n]) => n >= Math.min(2, products.length))
    .map(([n]) => n)
    .slice(0, 6);

  return sharedNames.map((label) => ({
    label,
    values: products.map((p) => {
      const s = p.specifications.find((x) => x.name === label);
      if (!s || !s.values) return "—";
      if (Array.isArray(s.values))
        return s.values.length ? s.values.map(String).join(", ") : "—";
      return String(s.values);
    }),
  }));
}

export function CompareTable({
  products,
  allProducts,
  onRemove,
  onAdd,
  maxCompare = 4,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  products: Product[];
  allProducts: Product[];
  onRemove: (productId: string) => void;
  onAdd: (p: Product) => void;
  maxCompare?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useLocale();
  const cheapest = useMemo(() => {
    if (products.length === 0) return null;
    return products.reduce((best, p) =>
      p.sellingPrice < best.sellingPrice ? p : best,
    );
  }, [products]);

  const dynRows = useMemo(() => specRows(products), [products]);

  const candidates = useMemo(() => {
    const inSet = new Set(products.map((p) => p.productId));
    return allProducts.filter((p) => !inSet.has(p.productId));
  }, [products, allProducts]);

  const canAdd = products.length < maxCompare;

  if (products.length === 0) {
    return <div className="ctable-empty">{t("compare.empty")}</div>;
  }

  return (
    <div className="ctable-wrap">
      {canAdd && candidates.length > 0 && (
        <div className="ctable-candidates">
          <div className="ctable-candidates-title">
            {t("compare.add_more")}
          </div>
          <div className="ctable-candidates-row">
            {candidates.map((p) => {
              const img = p.images[0]?.imageUrl;
              return (
                <button
                  key={p.productId}
                  type="button"
                  className="ccandidate"
                  onClick={() => onAdd(p)}
                  title={p.name}
                >
                  <div className="ccandidate-img">
                    {img ? (
                      <img src={img} alt="" loading="lazy" />
                    ) : (
                      <span className="ccandidate-img-fallback">
                        {(p.brand || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="ccandidate-name">{p.name}</div>
                  <div className="ccandidate-price">
                    {formatGTQ(p.sellingPrice)}
                  </div>
                  <span className="ccandidate-plus" aria-hidden="true">
                    +
                  </span>
                </button>
              );
            })}
            {hasMore && onLoadMore && (
              <button
                type="button"
                className="ccandidate ccandidate-loadmore"
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <span className="spinner-sm" />}
                {loadingMore ? t("result.loading_more") : t("result.load_more")}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="ctable-head">
        <h3>
          {t(
            products.length === 1
              ? "compare.heading_one"
              : "compare.heading_many",
            { n: products.length },
          )}
        </h3>
        <span className="ctable-hint">{t("compare.hint")}</span>
      </div>
      <div className="ctable-scroll">
        <table className="ctable">
          <thead>
            <tr>
              <th className="ctable-rowhead"></th>
              {products.map((p) => {
                const isBest = cheapest && p.productId === cheapest.productId;
                const brandLetter = (p.brand || "?")[0].toUpperCase();
                const firstImage = p.images[0]?.imageUrl;
                return (
                  <th key={p.productId} className={isBest ? "ctable-best" : ""}>
                    <div className="ctable-prod">
                      <button
                        type="button"
                        className="ctable-rm"
                        onClick={() => onRemove(p.productId)}
                        aria-label={t("compare.remove")}
                      >
                        ×
                      </button>
                      <div
                        className="ctable-prod-img"
                        style={{
                          background: firstImage
                            ? "#fff"
                            : `linear-gradient(135deg, ${gradientFor(p.brand)})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={p.name}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span>{brandLetter}</span>
                        )}
                      </div>
                      <div className="ctable-prod-name">{p.name}</div>
                      <div className="ctable-prod-price">
                        {formatGTQ(p.sellingPrice)}
                      </div>
                      {isBest && products.length > 1 && (
                        <span className="ctable-best-badge">
                          {t("compare.cheapest_badge")}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.labelKey}>
                <th className="ctable-rowhead">{t(row.labelKey)}</th>
                {products.map((p) => {
                  const value =
                    "render" in row && row.render
                      ? row.render(p)
                      : "—";
                  const isBestPrice =
                    row.labelKey === "compare.col.price" &&
                    cheapest &&
                    p.productId === cheapest.productId &&
                    products.length > 1;
                  return (
                    <td
                      key={p.productId}
                      className={`${row.emphasize ? "ctable-emph" : ""}${
                        isBestPrice ? " ctable-best-cell" : ""
                      }`}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {dynRows.map((row) => (
              <tr key={row.label}>
                <th className="ctable-rowhead">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cheapest && products.length > 1 && (
        <div className="ctable-foot">
          <span className="ctable-recommend">
            <span className="ctable-recommend-dot" />
            <strong>{t("compare.recommend_lead")}</strong>{" "}
            {cheapest.name.split(" ").slice(0, 5).join(" ")}{" "}
            {t("compare.recommend_tail")}
          </span>
          {cheapest.link && cheapest.link !== "#" && (
            <a
              className="btn btn-primary btn-sm"
              href={cheapest.link}
              target="_blank"
              rel="noreferrer"
            >
              {t("compare.see_walmart", {
                price: formatGTQ(cheapest.sellingPrice),
              })}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
