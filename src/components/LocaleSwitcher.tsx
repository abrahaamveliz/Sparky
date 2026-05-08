import { useLocale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="locale-switcher" role="group" aria-label="Language">
      <button
        type="button"
        className={`locale-btn${locale === "es" ? " active" : ""}`}
        onClick={() => setLocale("es")}
        aria-pressed={locale === "es"}
        title="Español"
      >
        ES
      </button>
      <button
        type="button"
        className={`locale-btn${locale === "en" ? " active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        title="English"
      >
        EN
      </button>
    </div>
  );
}
