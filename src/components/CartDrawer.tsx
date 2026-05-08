import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";
import { formatGTQ } from "@/lib/format";
import { buildWalmartCartUrl } from "@/lib/walmart-cart";
import { useLocale } from "@/lib/i18n";
import { QtyStepper } from "./QtyStepper";

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, count, total, inc, dec, remove, clear } = useCart();
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const checkoutUrl = buildWalmartCartUrl(
    items.map((it) => ({ sku: it.sku, qty: it.qty, seller: it.seller })),
  );

  return (
    <div className="cart-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className="cart-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={t("cart.title")}
      >
        <header className="cart-drawer-head">
          <div>
            <h2 className="cart-drawer-title">{t("cart.title")}</h2>
            <span className="cart-drawer-sub">
              {t(count === 1 ? "cart.subtitle_one" : "cart.subtitle_many", {
                n: count,
              })}{" "}
              · {formatGTQ(total)}
            </span>
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            onClick={onClose}
            aria-label={t("detail.back")}
          >
            ✕
          </button>
        </header>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
              <h3>{t("cart.empty.title")}</h3>
              <p>{t("cart.empty.body")}</p>
            </div>
          ) : (
            <ul className="cart-list">
              {items.map((it) => (
                <li className="cart-line" key={it.productId}>
                  <div className="cart-line-img">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} loading="lazy" />
                    ) : (
                      <div className="cart-line-img-fallback">—</div>
                    )}
                  </div>
                  <div className="cart-line-info">
                    <div className="cart-line-brand">{it.brand || "—"}</div>
                    <a
                      className="cart-line-name"
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {it.name}
                    </a>
                    <div className="cart-line-row">
                      <QtyStepper
                        qty={it.qty}
                        onInc={() => inc(it.productId)}
                        onDec={() => dec(it.productId)}
                        size="sm"
                      />
                      <span className="cart-line-price">
                        {formatGTQ(it.price * it.qty)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cart-line-remove"
                    onClick={() => remove(it.productId)}
                    aria-label={t("cart.line.remove")}
                    title={t("cart.line.remove")}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="cart-drawer-foot">
            <div className="cart-totals">
              <div className="cart-totals-row">
                <span>{t("cart.subtotal")}</span>
                <strong>{formatGTQ(total)}</strong>
              </div>
              <div className="cart-totals-hint">{t("cart.checkout.hint")}</div>
            </div>
            <a
              className="btn btn-primary btn-lg cart-checkout-btn"
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("cart.checkout")}
            </a>
            <button type="button" className="cart-clear-btn" onClick={clear}>
              {t("cart.clear")}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
