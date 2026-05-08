import { useState } from "react";
import { formatGTQ } from "@/lib/format";
import type { Product } from "@/lib/extract-products";
import { useCart } from "@/lib/cart-store";
import { useLocale } from "@/lib/i18n";
import { QtyStepper } from "./QtyStepper";

const BRAND_GRADIENTS: Record<string, string> = {
  MK: "#E0F2FE, #BAE6FD",
  VICK: "#DBEAFE, #93C5FD",
  TYLENOL: "#FEE2E2, #FCA5A5",
  HUGGIES: "#FEF3C7, #FCD34D",
  PAMPERS: "#DBEAFE, #BFDBFE",
  TENA: "#FCE7F3, #F9A8D4",
};

function gradientFor(brand: string): string {
  return BRAND_GRADIENTS[brand?.toUpperCase()] || "#F1F5F9, #CBD5E1";
}

export function ProductCard({
  product,
  onCompare,
  onDetail,
  compared,
  pinned,
  tag,
}: {
  product: Product;
  onCompare: (p: Product) => void;
  onDetail: (p: Product) => void;
  compared: boolean;
  pinned?: boolean;
  tag?: "cheap" | "discount" | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { add, has, qtyOf, inc, dec } = useCart();
  const { t } = useLocale();
  const inCart = has(product.productId);
  const cartQty = qtyOf(product.productId);
  const canAdd = product.skus.length > 0;
  const firstImage = product.images[0]?.imageUrl;
  const hasDiscount =
    product.listPrice > 0 && product.listPrice > product.sellingPrice;
  const discountPct =
    hasDiscount && product.listPrice > 0
      ? Math.round((1 - product.sellingPrice / product.listPrice) * 100)
      : 0;
  const brandLetter = (product.brand || "?")[0].toUpperCase();

  return (
    <div
      className={`pcard${compared ? " pcard-compared" : ""}${pinned ? " pcard-pinned" : ""}`}
    >
      <div className="pcard-img-wrap">
        {tag === "cheap" && (
          <span className="pcard-tag pcard-tag-cheap">
            {t("card.tag.cheapest")}
          </span>
        )}
        {tag === "discount" && hasDiscount && (
          <span className="pcard-tag pcard-tag-discount">
            {t("card.tag.discount", { pct: discountPct })}
          </span>
        )}

        <button
          type="button"
          className={`pcard-pin${pinned ? " active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onCompare(product);
          }}
          aria-label={
            pinned ? t("card.aria.pin_remove") : t("card.aria.pin_add")
          }
          title={pinned ? t("card.aria.pin_remove") : t("card.aria.pin_add")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 4l-1 1 1 5-4 4-3-1-2 2 4 4-5 5 1 1 5-5 4 4 2-2-1-3 4-4 5 1 1-1-11-11z" />
          </svg>
        </button>

        <button
          type="button"
          className="pcard-img"
          onClick={() => onDetail(product)}
          aria-label={t("card.aria.detail", { name: product.name })}
          style={{
            background: firstImage && !imgFailed
              ? "#fff"
              : `linear-gradient(135deg, ${gradientFor(product.brand)})`,
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {firstImage && !imgFailed ? (
            <img
              className={`pcard-img-real${imgLoaded ? "" : " pcard-img-real-loading"}`}
              src={firstImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="pcard-brand-glyph">{brandLetter}</span>
          )}
        </button>
      </div>

      <div className="pcard-body">
        <div className="pcard-brand">{product.brand || "—"}</div>
        <div className="pcard-name" title={product.name}>
          {product.name}
        </div>
        <div className="pcard-price-row">
          <span className="pcard-price">{formatGTQ(product.sellingPrice)}</span>
          {hasDiscount && (
            <span className="pcard-old">{formatGTQ(product.listPrice)}</span>
          )}
        </div>
        <div className="pcard-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onDetail(product)}
          >
            {t("card.details")}
          </button>
          {inCart ? (
            <QtyStepper
              qty={cartQty}
              onInc={() => inc(product.productId)}
              onDec={() => dec(product.productId)}
              size="sm"
            />
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => add(product, 1)}
              disabled={!canAdd}
              title={canAdd ? t("card.add") : t("card.no_sku")}
            >
              {t("card.add")}
            </button>
          )}
        </div>
        {compared && (
          <button
            type="button"
            className="pcard-compare-toggle"
            onClick={() => onCompare(product)}
            title={t("card.aria.pin_remove")}
          >
            {t("card.comparing")}
          </button>
        )}
        {!compared && (
          <button
            type="button"
            className="pcard-compare-toggle subtle"
            onClick={() => onCompare(product)}
            title={t("card.aria.pin_add")}
          >
            {t("card.compare")}
          </button>
        )}
      </div>
    </div>
  );
}

export { gradientFor };
