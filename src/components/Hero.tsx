import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { PRODUCT_NAME } from "@/lib/product-name";

const HERO_VIDEO_SRC =
  "https://player.vimeo.com/video/1127261132?h=6a89aae96a&badge=0&autopause=0&player_id=0&app_id=58479";

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: "hero.faq.q1", a: "hero.faq.a1" },
  { q: "hero.faq.q2", a: "hero.faq.a2" },
  { q: "hero.faq.q3", a: "hero.faq.a3" },
  { q: "hero.faq.q4", a: "hero.faq.a4" },
  { q: "hero.faq.q5", a: "hero.faq.a5" },
];

export function Hero() {
  const { t } = useLocale();
  const name = PRODUCT_NAME;
  // Single-open accordion: first item starts open, clicking another item
  // switches the open one. Clicking the already-open item is a no-op (we
  // never want zero open).
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="hero">
      <div className="hero-video">
        <iframe
          src={HERO_VIDEO_SRC}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          title="AI shopping assistant"
        />
      </div>

      <section className="hero-faq">
        <h3 className="hero-faq-heading">{t("hero.faq.heading")}</h3>
        {FAQ_ITEMS.map(({ q, a }, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={q}
              className={`hero-faq-item${isOpen ? " is-open" : ""}`}
            >
              <button
                type="button"
                className="hero-faq-summary"
                onClick={() => setOpenIdx(i)}
                aria-expanded={isOpen}
              >
                <span>{t(q, { name })}</span>
                <span className="hero-faq-chev" aria-hidden="true">
                  ▾
                </span>
              </button>
              {isOpen && <p>{t(a, { name })}</p>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
