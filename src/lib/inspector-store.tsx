import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type InspectorStatus = "running" | "ok" | "error";

export type InspectorEntry = {
  id: string;
  time: string;
  name: string;
  status: InspectorStatus;
  latency: number | null;
  startedAt: number;
  sizeIn: number;
  sizeOut: number;
  input?: unknown;
  output?: unknown;
  error?: string;
};

type InspectorContextValue = {
  entries: InspectorEntry[];
  upsert: (
    entry: Partial<InspectorEntry> & { id: string; name: string },
  ) => void;
  clear: () => void;
};

const InspectorContext = createContext<InspectorContextValue | null>(null);

// Cap on retained inspector entries. Keeps long demo sessions from growing
// the trace panel unbounded — anything past this is evicted oldest-first.
// Existing entries are still updated by id (no eviction on update), so an
// in-flight call can complete even after it scrolls out of the cap window.
const MAX_INSPECTOR_ENTRIES = 50;

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<InspectorEntry[]>([]);

  const upsert = useCallback<InspectorContextValue["upsert"]>((patch) => {
    setEntries((prev) => {
      const idx = prev.findIndex((x) => x.id === patch.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch } as InspectorEntry;
        return next;
      }
      const defaults = {
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        status: "running" as const,
        latency: null,
        startedAt: performance.now(),
        sizeIn: 0,
        sizeOut: 0,
      };
      const fresh: InspectorEntry = { ...defaults, ...patch };
      const next = [fresh, ...prev];
      return next.length > MAX_INSPECTOR_ENTRIES
        ? next.slice(0, MAX_INSPECTOR_ENTRIES)
        : next;
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo(
    () => ({ entries, upsert, clear }),
    [entries, upsert, clear],
  );

  return (
    <InspectorContext.Provider value={value}>
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error("useInspector must be used inside InspectorProvider");
  return ctx;
}

export function byteLen(value: unknown): number {
  if (value == null) return 0;
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
