import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ThreadPrimitive } from "@assistant-ui/react";
import { useLocale } from "@/lib/i18n";
import { WALMART_CATEGORIES } from "@/lib/walmart-categories";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The button that triggered the popover. Used to anchor positioning and
   *  to whitelist clicks on it (so toggling-via-the-button still works
   *  without the outside-click handler immediately re-closing). */
  anchorRef: RefObject<HTMLElement | null>;
};

const POPOVER_WIDTH = 760;
const VIEWPORT_MARGIN = 16;

export function CategoryMegaMenu({ open, onClose, anchorRef }: Props) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(WALMART_CATEGORIES[0]?.slug ?? "");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Compute popover position from the anchor's bounding rect — recompute on
  // resize/scroll so the popover follows the trigger if the layout shifts.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
      setPos({ top: rect.bottom + 8, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  // Outside-click + Esc to close. The anchor is whitelisted so clicking the
  // trigger button to toggle the popover doesn't trigger a double-close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
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
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  const activeCat =
    WALMART_CATEGORIES.find((c) => c.slug === active) ?? WALMART_CATEGORIES[0];
  if (!activeCat) return null;

  return createPortal(
    <div
      className="cat-mega"
      role="dialog"
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
    >
      <div className="cat-mega-list">
        {WALMART_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`cat-mega-cat ${c.slug === active ? "is-active" : ""}`}
            onMouseEnter={() => setActive(c.slug)}
            onFocus={() => setActive(c.slug)}
          >
            <span className="cat-mega-cat-name">{c.name}</span>
            <span className="cat-mega-arrow" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>

      <div className="cat-mega-subs">
        <div className="cat-mega-subs-title">{activeCat.name}</div>
        <div className="cat-mega-subs-grid">
          <ThreadPrimitive.Suggestion
            prompt={t("mega.search_all", { category: activeCat.name })}
            method="replace"
            autoSend
            asChild
          >
            <button
              type="button"
              className="cat-mega-sub cat-mega-sub--all"
              onClick={onClose}
            >
              {t("mega.see_all")} {activeCat.name} →
            </button>
          </ThreadPrimitive.Suggestion>
          {activeCat.children.length === 0 && (
            <span className="cat-mega-empty">{t("mega.no_subs")}</span>
          )}
          {activeCat.children.map((s) => (
            <ThreadPrimitive.Suggestion
              key={s.slug}
              prompt={t("mega.search_sub", { category: s.name })}
              method="replace"
              autoSend
              asChild
            >
              <button
                type="button"
                className="cat-mega-sub"
                onClick={onClose}
              >
                {s.name}
              </button>
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
