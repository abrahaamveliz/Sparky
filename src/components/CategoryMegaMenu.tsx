import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useChat } from "@/lib/use-chat";
import { useLocale } from "@/lib/i18n";
import { WALMART_CATEGORIES } from "@/lib/walmart-categories";

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
};

const POPOVER_WIDTH = 760;
const VIEWPORT_MARGIN = 16;

/** Breakpoint matching the CSS max-width:767px mobile sheet override. */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export function CategoryMegaMenu({ open, onClose, anchorRef }: Props) {
  const { t } = useLocale();
  const { send } = useChat();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(WALMART_CATEGORIES[0]?.slug ?? "");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isMobile = useIsMobile();

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

  const handleCategoryClick = (slug: string) => {
    // On mobile: toggle accordion (tap same = collapse)
    if (isMobile) {
      setActive((prev) => (prev === slug ? "" : slug));
    } else {
      setActive(slug);
    }
  };

  const handleSubClick = (parentSlug: string, subName: string, subSlug: string) => {
    send(
      t("mega.search_sub", { category: subName }) +
      ` [category:${parentSlug}/${subSlug}]`,
    );
    onClose();
  };

  const handleSeeAll = (cat: typeof activeCat) => {
    send(
      t("mega.search_all", { category: cat.name }) +
      ` [category:${cat.slug}]`,
    );
    onClose();
  };

  // Mobile: accordion layout — subcategories expand inline below each category
  if (isMobile) {
    return createPortal(
      <div
        className="cat-mega cat-mega--mobile"
        role="dialog"
        aria-label={t("subnav.categorias")}
        ref={ref}
        style={{ position: "fixed", top: pos.top, left: pos.left }}
      >
        <div className="cat-mega-list cat-mega-list--accordion">
          {WALMART_CATEGORIES.map((c) => {
            const isExpanded = active === c.slug;
            return (
              <div key={c.slug} className="cat-mega-accordion-item">
                <button
                  type="button"
                  className={`cat-mega-cat ${isExpanded ? "is-active" : ""}`}
                  onClick={() => handleCategoryClick(c.slug)}
                >
                  <span className="cat-mega-cat-name">{c.name}</span>
                  <span
                    className={`cat-mega-accordion-chev ${isExpanded ? "is-open" : ""}`}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
                {isExpanded && (
                  <div className="cat-mega-accordion-subs">
                    <button
                      type="button"
                      className="cat-mega-sub cat-mega-sub--all"
                      onClick={() => handleSeeAll(c)}
                    >
                      {t("mega.see_all")} {c.name} →
                    </button>
                    {c.children.length === 0 && (
                      <span className="cat-mega-empty">{t("mega.no_subs")}</span>
                    )}
                    {c.children.map((s) => (
                      <button
                        key={s.slug}
                        type="button"
                        className="cat-mega-sub"
                        onClick={() => handleSubClick(c.slug, s.name, s.slug)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop: side-by-side layout (unchanged)
  return createPortal(
    <div
      className="cat-mega"
      role="dialog"
      aria-label={t("subnav.categorias")}
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
            onClick={() => setActive(c.slug)}
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
          <button
            type="button"
            className="cat-mega-sub cat-mega-sub--all"
            onClick={() => handleSeeAll(activeCat)}
          >
            {t("mega.see_all")} {activeCat.name} →
          </button>
          {activeCat.children.length === 0 && (
            <span className="cat-mega-empty">{t("mega.no_subs")}</span>
          )}
          {activeCat.children.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="cat-mega-sub"
              onClick={() => handleSubClick(activeCat.slug, s.name, s.slug)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}