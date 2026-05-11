import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { PRODUCT_NAME } from "@/lib/product-name";

const HERO_VIDEO_SRC =
  "https://player.vimeo.com/video/1127261132?h=6a89aae96a&badge=0&autopause=0&player_id=0&app_id=58479";

// If the Vimeo iframe never fires `load` within this window, treat it as a
// network failure and show a static fallback. Real loads on a slow phone
// are usually well under 4s.
const VIDEO_LOAD_TIMEOUT_MS = 6000;

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

  const [videoState, setVideoState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setVideoState((s) => (s === "loading" ? "failed" : s));
    }, VIDEO_LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="hero">
      <div className={`hero-video hero-video--${videoState}`}>
        {videoState !== "failed" && (
          <iframe
            src={HERO_VIDEO_SRC}
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
            title={t("hero.video.title", { name })}
            onLoad={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setVideoState("ready");
            }}
          />
        )}
        {videoState === "loading" && (
          <div className="hero-video-skeleton" aria-hidden="true">
            <div className="hero-video-shimmer" />
          </div>
        )}
        {videoState === "failed" && (
          <div className="hero-video-fallback" role="img" aria-label={t("hero.video.title", { name })}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>{t("hero.video.fallback")}</span>
          </div>
        )}
      </div>

      <section className="hero-faq" aria-labelledby="hero-faq-heading">
        <h2 id="hero-faq-heading" className="hero-faq-heading">
          {t("hero.faq.heading")}
        </h2>
        {FAQ_ITEMS.map(({ q, a }, i) => {
          const isOpen = openIdx === i;
          const panelId = `hero-faq-panel-${i}`;
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
                aria-controls={panelId}
              >
                <span>{t(q, { name })}</span>
                <span className="hero-faq-chev" aria-hidden="true">
                  ▾
                </span>
              </button>
              <p id={panelId} hidden={!isOpen}>
                {t(a, { name })}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
