import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useLocale } from "@/lib/i18n";

// Once-ever flag for the first-add coachmark. Persisted across sessions —
// after the user sees it once we never nudge again.
const POPOVER_SEEN_KEY = "walmart-mcp:cart-popover-seen";

export function CartButton({ onClick }: { onClick: () => void }) {
  const { count } = useCart();
  const { t } = useLocale();
  const ariaLabel =
    count === 0
      ? t("cart.button.aria")
      : count === 1
        ? t("cart.button.aria_count_one", { n: count })
        : t("cart.button.aria_count_many", { n: count });

  // One-shot bump animation when an item is added (count grows). Decrements
  // and the initial-mount value don't trigger it so removing/loading from
  // storage stays silent.
  const prevCountRef = useRef(count);
  const [bump, setBump] = useState(false);

  // First-add coachmark popover. Appears once ever when the cart goes from
  // 0 → ≥1. Dismisses on the close button OR when the cart drawer opens.
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setBump(true);
      const wentFromEmpty = prevCountRef.current === 0 && count > 0;
      if (wentFromEmpty) {
        try {
          if (!localStorage.getItem(POPOVER_SEEN_KEY)) {
            setPopoverOpen(true);
            localStorage.setItem(POPOVER_SEEN_KEY, "1");
          }
        } catch {
          // private mode / quota — silently skip
        }
      }
      const id = setTimeout(() => setBump(false), 600);
      prevCountRef.current = count;
      return () => clearTimeout(id);
    }
    prevCountRef.current = count;
  }, [count]);

  const dismissPopover = () => setPopoverOpen(false);

  const handleClick = () => {
    dismissPopover();
    onClick();
  };

  return (
    <div className="cart-btn-wrap">
      <button
        type="button"
        className={`cart-btn${bump ? " is-bumping" : ""}`}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
        <span className="cart-btn-label">{t("topbar.cart")}</span>
        {count > 0 && <span className="cart-btn-badge">{count}</span>}
      </button>
      {popoverOpen && (
        <div
          className="cart-popover"
          role="status"
          aria-live="polite"
        >
          <div className="cart-popover-text">
            <strong>{t("cart.popover.title")}</strong>
            <span>{t("cart.popover.body")}</span>
          </div>
          <button
            type="button"
            className="cart-popover-close"
            onClick={dismissPopover}
            aria-label={t("cart.popover.close")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
