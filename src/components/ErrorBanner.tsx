import { useErrorStore } from "@/lib/error-store";
import { useLocale } from "@/lib/i18n";

export function ErrorBanner() {
  const { error, dismiss } = useErrorStore();
  const { t } = useLocale();
  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-icon">⚠</span>
      <div className="error-banner-text">
        <strong>{t(`error.${error.category}.title`)}</strong>
        <span>{t(`error.${error.category}.body`)}</span>
      </div>
      <button
        type="button"
        className="error-banner-dismiss"
        onClick={dismiss}
        aria-label={t("error.dismiss")}
      >
        ✕
      </button>
    </div>
  );
}
