import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppError = {
  /** Maps to a localized banner template via `t("error." + category + ".title/body")`. */
  category: "network" | "auth" | "config" | "unknown";
  message: string;
};

type ErrorContextValue = {
  error: AppError | null;
  setError: (e: AppError | null) => void;
  dismiss: () => void;
};

const ErrorContext = createContext<ErrorContextValue | null>(null);

/** Best-effort classification of an unknown error from the AI SDK runtime
 *  / fetch layer. The api/chat endpoint already returns a structured
 *  `{ error: { category, message } }` payload; we try to extract that
 *  first, then fall back to keyword sniffing on the error message. */
export function classifyClientError(err: unknown): AppError {
  if (err instanceof Error) {
    const msg = err.message;
    // Try to extract structured payload from `Failed to load: ...{...}`
    const jsonMatch = msg.match(/\{[^]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.error?.category && parsed?.error?.message) {
          return parsed.error as AppError;
        }
      } catch {
        // fall through
      }
    }
    if (/(failed to fetch|network|ECONNREFUSED|ENOTFOUND|timeout)/i.test(msg)) {
      return { category: "network", message: msg };
    }
    if (/(401|403|unauthorized|forbidden|api[ _-]?key)/i.test(msg)) {
      return { category: "auth", message: msg };
    }
    return { category: "unknown", message: msg };
  }
  return { category: "unknown", message: String(err ?? "Unknown error") };
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<AppError | null>(null);

  const dismiss = useCallback(() => setError(null), []);

  const value = useMemo<ErrorContextValue>(
    () => ({ error, setError, dismiss }),
    [error, dismiss],
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function useErrorStore() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error("useErrorStore must be used inside ErrorProvider");
  return ctx;
}
