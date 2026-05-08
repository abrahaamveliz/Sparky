import { useEffect, useState } from "react";
import { formatGTQ } from "@/lib/format";
import type { Product } from "@/lib/extract-products";
import { gradientFor } from "./ProductCard";
import { useCart } from "@/lib/cart-store";
import { useLocale } from "@/lib/i18n";
import { QtyStepper } from "./QtyStepper";

export function DetailPane({
  product,
  onBack,
  onCompare,
  compared,
}: {
  product: Product;
  onBack: () => void;
  onCompare: (p: Product) => void;
  compared: boolean;
}) {
  const { t } = useLocale();
  const [imgIdx, setImgIdx] = useState(0);
  const images = product.images;
  const hasImages = images.length > 0;
  const hasDiscount =
    product.listPrice > 0 && product.listPrice > product.sellingPrice;

  useEffect(() => {
    setImgIdx(0);
  }, [product.productId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasImages && images.length > 1) {
        setImgIdx((i) => (i - 1 + images.length) % images.length);
      }
      if (e.key === "ArrowRight" && hasImages && images.length > 1) {
        setImgIdx((i) => (i + 1) % images.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasImages, images.length]);

  const visibleSpecs = product.specifications.filter((s) => {
    if (!s.values) return false;
    if (Array.isArray(s.values)) return s.values.length > 0;
    return true;
  });

  const brandLetter = (product.brand || "?")[0].toUpperCase();

  return (
    <div className="detail">
      <button type="button" className="detail-back" onClick={onBack}>
        {t("detail.back")}
      </button>
      <div className="detail-grid">
        <div
          className="detail-img"
          style={{
            background: hasImages
              ? "#fff"
              : `linear-gradient(135deg, ${gradientFor(product.brand)})`,
            border: "1px solid var(--border)",
          }}
        >
          {hasImages ? (
            <img
              src={images[imgIdx].imageUrl}
              alt={images[imgIdx].imageText || product.name}
              loading="lazy"
              style={{
                maxWidth: "92%",
                maxHeight: "92%",
                objectFit: "contain",
              }}
            />
          ) : (
            <span className="detail-img-glyph">{brandLetter}</span>
          )}
          {images.length > 1 && (
            <div className="detail-img-thumbs">
              {images.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`thumb${i === imgIdx ? " active" : ""}`}
                  onClick={() => setImgIdx(i)}
                  aria-label={t("detail.image_aria", { n: i + 1 })}
                  style={{ border: "none", padding: 0, cursor: "pointer" }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-brand">{product.brand || "—"}</div>
          <h2 className="detail-name">{product.name}</h2>
          <div className="detail-price-row">
            <span className="detail-price">{formatGTQ(product.sellingPrice)}</span>
            {hasDiscount && (
              <span className="detail-old">{formatGTQ(product.listPrice)}</span>
            )}
            <span className="detail-stock">
              <span className="stock-dot" /> {t("detail.in_stock")}
            </span>
          </div>
          {product.description && (
            <p className="detail-desc">{product.description}</p>
          )}
          {visibleSpecs.length > 0 && (
            <div className="detail-specs">
              {visibleSpecs.slice(0, 6).map((s, i) => (
                <div key={i} className="spec">
                  <span>{s.name}</span>
                  <strong>
                    {Array.isArray(s.values)
                      ? s.values.map(String).join(", ")
                      : String(s.values ?? "—")}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <DetailActions
            product={product}
            compared={compared}
            onCompare={onCompare}
          />
          <a
            className="detail-walmart-link"
            href={product.link}
            target="_blank"
            rel="noreferrer"
          >
            {t("detail.view_walmart")}
          </a>
          <div className="detail-disclaimer">{t("detail.live_disclaimer")}</div>
        </div>
      </div>
    </div>
  );
}

function DetailActions({
  product,
  compared,
  onCompare,
}: {
  product: Product;
  compared: boolean;
  onCompare: (p: Product) => void;
}) {
  const { add, has, qtyOf, inc, dec } = useCart();
  const { t } = useLocale();
  const inCart = has(product.productId);
  const cartQty = qtyOf(product.productId);
  const canAdd = product.skus.length > 0;

  return (
    <div className="detail-actions">
      {inCart ? (
        <div className="detail-cart-row">
          <QtyStepper
            qty={cartQty}
            onInc={() => inc(product.productId)}
            onDec={() => dec(product.productId)}
            size="md"
          />
          <span className="detail-cart-row-label">{t("detail.in_cart")}</span>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => add(product, 1)}
          disabled={!canAdd}
        >
          {t("detail.add_to_cart")}
        </button>
      )}
      <button
        type="button"
        className={`btn btn-outline btn-lg${compared ? " active" : ""}`}
        onClick={() => onCompare(product)}
      >
        {compared ? t("detail.in_comparison") : t("detail.compare_btn")}
      </button>
    </div>
  );
}
