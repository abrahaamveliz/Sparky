import { useEffect, useState } from "react";
import {
  usePreferences,
  type Diet,
} from "@/lib/preferences-store";
import { useLocale } from "@/lib/i18n";
import { formatGTQ } from "@/lib/format";

const DIET_KEYS: Diet[] = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "lactose-free",
  "no-pork",
  "keto",
];

const COMMON_BRANDS = [
  "GREAT VALUE",
  "MARINELA",
  "GERBER",
  "MAGGI",
  "KNORR",
  "MALHER",
  "DEL FRESCO",
  "HORTIFRUTI",
  "LALA",
  "DOS PINOS",
  "COCA-COLA",
  "PEPSI",
  "HUGGIES",
  "PAMPERS",
];

export function PreferencesDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const {
    preferences,
    setBudget,
    setHousehold,
    toggleDiet,
    setPreferredBrands,
    reset,
  } = usePreferences();

  const [budgetInput, setBudgetInput] = useState(
    preferences.budgetCap?.toString() ?? "",
  );

  useEffect(() => {
    setBudgetInput(preferences.budgetCap?.toString() ?? "");
  }, [preferences.budgetCap, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const commitBudget = () => {
    const n = parseInt(budgetInput, 10);
    setBudget(Number.isFinite(n) && n > 0 ? n : null);
  };

  const toggleBrand = (brand: string) => {
    const next = preferences.preferredBrands.includes(brand)
      ? preferences.preferredBrands.filter((b) => b !== brand)
      : [...preferences.preferredBrands, brand];
    setPreferredBrands(next);
  };

  return (
    <div
      className="prefs-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className="prefs-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={t("prefs.title")}
      >
        <header className="prefs-head">
          <div>
            <h2 className="prefs-title">{t("prefs.title")}</h2>
            <span className="prefs-sub">{t("prefs.subtitle")}</span>
          </div>
          <button
            type="button"
            className="prefs-close"
            onClick={onClose}
            aria-label={t("error.dismiss")}
          >
            ✕
          </button>
        </header>

        <div className="prefs-body">
          {/* Budget */}
          <section className="prefs-section">
            <label className="prefs-label" htmlFor="prefs-budget">
              {t("prefs.budget.label")}
            </label>
            <div className="prefs-budget-row">
              <span className="prefs-budget-currency">Q</span>
              <input
                id="prefs-budget"
                type="number"
                min="0"
                step="50"
                placeholder={t("prefs.budget.placeholder")}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="prefs-budget-input"
              />
              {preferences.budgetCap !== null && (
                <button
                  type="button"
                  className="prefs-budget-clear"
                  onClick={() => {
                    setBudget(null);
                    setBudgetInput("");
                  }}
                >
                  {t("prefs.budget.clear")}
                </button>
              )}
            </div>
            {preferences.budgetCap !== null && (
              <span className="prefs-hint">
                {t("prefs.budget.current", {
                  amount: formatGTQ(preferences.budgetCap),
                })}
              </span>
            )}
          </section>

          {/* Household size */}
          <section className="prefs-section">
            <label className="prefs-label">{t("prefs.household.label")}</label>
            <div className="prefs-household-row">
              <button
                type="button"
                className="prefs-stepper-btn"
                onClick={() => setHousehold(preferences.household - 1)}
                disabled={preferences.household <= 1}
                aria-label={t("qty.decrement")}
              >
                −
              </button>
              <span className="prefs-household-num">
                {preferences.household}
              </span>
              <button
                type="button"
                className="prefs-stepper-btn"
                onClick={() => setHousehold(preferences.household + 1)}
                disabled={preferences.household >= 20}
                aria-label={t("qty.increment")}
              >
                +
              </button>
              <span className="prefs-hint prefs-hint-inline">
                {t(
                  preferences.household === 1
                    ? "prefs.household.unit_one"
                    : "prefs.household.unit_many",
                )}
              </span>
            </div>
          </section>

          {/* Diet */}
          <section className="prefs-section">
            <label className="prefs-label">{t("prefs.diet.label")}</label>
            <div className="prefs-checks">
              {DIET_KEYS.map((d) => (
                <label key={d} className="prefs-check">
                  <input
                    type="checkbox"
                    checked={preferences.diet.includes(d)}
                    onChange={() => toggleDiet(d)}
                  />
                  <span>{t(`prefs.diet.${d}`)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Preferred brands */}
          <section className="prefs-section">
            <label className="prefs-label">{t("prefs.brands.label")}</label>
            <div className="prefs-brand-chips">
              {COMMON_BRANDS.map((b) => {
                const active = preferences.preferredBrands.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    className={`prefs-brand-chip${active ? " active" : ""}`}
                    onClick={() => toggleBrand(b)}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            <span className="prefs-hint">{t("prefs.brands.hint")}</span>
          </section>
        </div>

        <footer className="prefs-foot">
          <button type="button" className="prefs-reset-btn" onClick={reset}>
            {t("prefs.reset")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t("prefs.done")}
          </button>
        </footer>
      </aside>
    </div>
  );
}
