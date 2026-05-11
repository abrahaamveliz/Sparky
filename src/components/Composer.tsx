import { ComposerPrimitive, useAuiState } from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";
import { useLocale } from "@/lib/i18n";

const COMPOSER_MAX_CHARS = 4000;
const COMPOSER_COUNTER_AT = 3500;

export function Composer() {
  const running = useThreadIsRunning();
  const { t } = useLocale();
  const text = useAuiState((s: { composer: { text: string } }) => s.composer.text) ?? "";
  const remaining = COMPOSER_MAX_CHARS - text.length;
  const showCounter = text.length >= COMPOSER_COUNTER_AT;
  const overLimit = remaining < 0;

  return (
    <div className="composer-wrap">
      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input
          className="composer-input"
          placeholder={
            running ? t("loading.processing") : t("composer.placeholder")
          }
          rows={1}
          autoFocus
          maxLength={COMPOSER_MAX_CHARS}
          aria-label={t("composer.placeholder")}
        />
        <div className="composer-actions">
          {running ? (
            <ComposerPrimitive.Cancel
              className="composer-send composer-send--cancel"
              aria-label={t("composer.cancel")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </ComposerPrimitive.Cancel>
          ) : (
            <ComposerPrimitive.Send
              className="composer-send"
              aria-label={t("composer.send")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </ComposerPrimitive.Send>
          )}
        </div>
      </ComposerPrimitive.Root>
      <div className="composer-foot">
        <span className="composer-disclaimer">{t("footer.disclaimer")}</span>
        {showCounter && (
          <span
            className={`composer-counter${overLimit ? " is-over" : ""}`}
            aria-live="polite"
          >
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}
