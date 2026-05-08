/**
 * Compact +/- quantity stepper used inside ProductCard, DetailPane, and the
 * cart drawer. Always renders inline with a fixed width so layout doesn't jump.
 */

import { useLocale } from "@/lib/i18n";

export function QtyStepper({
  qty,
  onInc,
  onDec,
  size = "sm",
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  return (
    <div className={`qty-stepper qty-stepper-${size}`}>
      <button
        type="button"
        className="qty-btn"
        onClick={onDec}
        aria-label={t("qty.decrement")}
      >
        −
      </button>
      <span className="qty-num" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="qty-btn"
        onClick={onInc}
        aria-label={t("qty.increment")}
      >
        +
      </button>
    </div>
  );
}
