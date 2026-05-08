import { useState } from "react";
import type { InspectorEntry } from "@/lib/inspector-store";

export function TraceStrip({ steps }: { steps: InspectorEntry[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  const total = steps.reduce((s, e) => s + (e.latency ?? 0), 0);
  const allRunning = steps.every((s) => s.status === "running");

  return (
    <div className="trace">
      <button
        type="button"
        className="trace-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="trace-pill">
          <span className={`trace-dot${allRunning ? " trace-dot-pulse" : ""}`} />
          MCP
        </span>
        <span className="trace-steps">
          {steps.map((s, i) => (
            <span key={s.id} className="trace-step">
              <span className="trace-step-name">{s.name}</span>
              {s.latency != null && (
                <span className="trace-step-lat">{s.latency}ms</span>
              )}
              {i < steps.length - 1 && <span className="trace-arrow">→</span>}
            </span>
          ))}
        </span>
        <span className="trace-total">{total}ms total</span>
        <span className={`trace-chev${open ? " open" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="trace-body">
          {steps.map((s, i) => (
            <div key={s.id} className="trace-row">
              <div className="trace-row-head">
                <span className="trace-row-num">{i + 1}</span>
                <span className="trace-row-name">{s.name}</span>
                <span className="trace-row-meta">
                  {s.sizeIn}b in · {s.sizeOut}b out
                </span>
                <span className="trace-row-lat">
                  {s.latency != null ? `${s.latency}ms` : "running"}
                </span>
              </div>
              <pre className="trace-code">
                {JSON.stringify(s.input ?? {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
