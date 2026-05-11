import type { InspectorEntry } from "@/lib/inspector-store";
import { useLocale } from "@/lib/i18n";
import { HScrollGrid } from "./HScrollGrid";

export function ResultLoading({
  query,
}: {
  query?: string;
  // Kept in the signature so callers don't have to change; intentionally
  // not rendered — MCP step traces are an internal-only concept.
  steps?: InspectorEntry[];
}) {
  const { t } = useLocale();
  return (
    <div
      className="result result-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="result-head">
        <div className="result-head-text">
          <span className="result-icon">
            <span className="spinner-sm" />
          </span>
          <span className="result-summary">
            {query ? (
              <>
                {t("loading.searching_prefix")}{" "}
                <strong>"{query}"</strong>{" "}
                {t("loading.searching_suffix")}
              </>
            ) : (
              <>{t("loading.working")}</>
            )}
          </span>
        </div>
      </div>
      <HScrollGrid>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="pcard pcard-skeleton" />
        ))}
      </HScrollGrid>
    </div>
  );
}
