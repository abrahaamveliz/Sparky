import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import {
  NAV_BAR_ASSET_1,
  NAV_BAR_ASSET_2,
  NAV_BAR_ASSET_3,
} from "@/lib/product-name";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenCart: () => void;
  /** Anchoring is handled by the parent via CSS; this component just renders
   *  the panel content. */
};

const ASSET_KEYS: { url: string; key: string }[] = [
  { url: NAV_BAR_ASSET_1, key: "delivery.popover.option1" },
  { url: NAV_BAR_ASSET_2, key: "delivery.popover.option2" },
  { url: NAV_BAR_ASSET_3, key: "delivery.popover.option3" },
];

export function DeliveryPopover({ open, onClose, onOpenCart }: Props) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const visibleAssets = ASSET_KEYS.filter((a) => a.url);

  return (
    <div
      className="delivery-popover"
      role="dialog"
      aria-label={t("delivery.popover.title")}
      ref={ref}
    >
      <div className="delivery-popover-title">{t("delivery.popover.title")}</div>

      {visibleAssets.length > 0 && (
        <div className="delivery-popover-options">
          {visibleAssets.map((a) => (
            <div key={a.key} className="delivery-popover-option">
              <div className="delivery-popover-icon">
                <img src={a.url} alt="" loading="lazy" />
              </div>
              <span>{t(a.key)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="delivery-popover-card">
        <p>{t("delivery.popover.body")}</p>
        <button
          type="button"
          className="delivery-popover-cta"
          onClick={() => {
            onClose();
            onOpenCart();
          }}
        >
          {t("delivery.popover.cta")}
        </button>
      </div>
    </div>
  );
}
