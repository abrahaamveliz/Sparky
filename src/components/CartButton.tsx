import { useCart } from "@/lib/cart-store";
import { useLocale } from "@/lib/i18n";

export function CartButton({ onClick }: { onClick: () => void }) {
  const { count } = useCart();
  const { t } = useLocale();
  return (
    <button
      type="button"
      className="cart-btn"
      onClick={onClick}
      aria-label={t("cart.button.aria")}
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
  );
}
