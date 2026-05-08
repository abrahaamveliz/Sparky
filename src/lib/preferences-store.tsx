import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "walmart-mcp:preferences";

export type Diet =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "lactose-free"
  | "no-pork"
  | "keto";

export type Preferences = {
  /** Total budget in Q. null means no cap. */
  budgetCap: number | null;
  /** Number of people the cart should serve. Default 2. */
  household: number;
  /** Active dietary flags. Empty = no constraints. */
  diet: Diet[];
  /** Preferred brand names (uppercase). Soft preference — picker boosts these. */
  preferredBrands: string[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  budgetCap: null,
  household: 2,
  diet: [],
  preferredBrands: [],
};

type PreferencesContextValue = {
  preferences: Preferences;
  setBudget: (q: number | null) => void;
  setHousehold: (n: number) => void;
  toggleDiet: (d: Diet) => void;
  setPreferredBrands: (brands: string[]) => void;
  reset: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStorage(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      budgetCap:
        typeof parsed.budgetCap === "number" ? parsed.budgetCap : null,
      household:
        typeof parsed.household === "number" && parsed.household > 0
          ? parsed.household
          : DEFAULT_PREFERENCES.household,
      diet: Array.isArray(parsed.diet) ? (parsed.diet as Diet[]) : [],
      preferredBrands: Array.isArray(parsed.preferredBrands)
        ? (parsed.preferredBrands as string[])
        : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => readStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore quota / private mode
    }
  }, [preferences]);

  const setBudget = useCallback(
    (q: number | null) =>
      setPreferences((p) => ({ ...p, budgetCap: q })),
    [],
  );
  const setHousehold = useCallback(
    (n: number) =>
      setPreferences((p) => ({
        ...p,
        household: Math.max(1, Math.min(20, Math.round(n))),
      })),
    [],
  );
  const toggleDiet = useCallback((d: Diet) => {
    setPreferences((p) => ({
      ...p,
      diet: p.diet.includes(d) ? p.diet.filter((x) => x !== d) : [...p.diet, d],
    }));
  }, []);
  const setPreferredBrands = useCallback((brands: string[]) => {
    setPreferences((p) => ({
      ...p,
      preferredBrands: brands.map((b) => b.toUpperCase()),
    }));
  }, []);
  const reset = useCallback(() => setPreferences(DEFAULT_PREFERENCES), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setBudget,
      setHousehold,
      toggleDiet,
      setPreferredBrands,
      reset,
    }),
    [preferences, setBudget, setHousehold, toggleDiet, setPreferredBrands, reset],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
