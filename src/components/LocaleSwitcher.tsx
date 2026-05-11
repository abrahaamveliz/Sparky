import { useLocale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className="locale-switcher"
      role="group"
      aria-label={t("a11y.lang_label")}
    >
      <button
        type="button"
        className={`locale-btn${locale === "es" ? " active" : ""}`}
        onClick={() => setLocale("es")}
        aria-pressed={locale === "es"}
        lang="es"
        title="Español"
      >
        ES
      </button>
      <button
        type="button"
        className={`locale-btn${locale === "en" ? " active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        lang="en"
        title="English"
      >
        EN
      </button>
    </div>
  );
}
