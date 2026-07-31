import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat } from "@/lib/use-chat";
import { useLocale } from "@/lib/i18n";

const COMPOSER_MAX_CHARS = 4000;
const COMPOSER_COUNTER_AT = 3500;

export function Composer() {
  const { send, isStreaming } = useChat();
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const remaining = COMPOSER_MAX_CHARS - value.length;
  const showCounter = value.length >= COMPOSER_COUNTER_AT;
  const overLimit = remaining < 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || isStreaming || overLimit) return;
    send(value);
    setValue("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="composer-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming ? t("loading.processing") : t("composer.placeholder")
          }
          rows={1}
          maxLength={COMPOSER_MAX_CHARS}
          disabled={isStreaming}
          autoFocus
          aria-label={t("composer.placeholder")}
        />
        <div className="composer-actions">
          <button
            type="submit"
            className="composer-send"
            disabled={!value.trim() || isStreaming || overLimit}
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
          </button>
        </div>
      </form>
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