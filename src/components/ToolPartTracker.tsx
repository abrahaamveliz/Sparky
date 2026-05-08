/**
 * Invisible component that mirrors a tool-call message part's lifecycle into
 * the inspector store. Rendered once per tool part inside the assistant
 * message via MessagePrimitive.Parts so each tool gets its own tracker.
 *
 * The actual tool call data is read by ResultBlock from the inspector store
 * (so trace strip / loading state get latency, byte sizes, status). The
 * tracker has no visible output.
 */

import { useEffect, useRef } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { byteLen, useInspector } from "@/lib/inspector-store";

export function ToolPartTracker(props: ToolCallMessagePartProps) {
  const { toolCallId, toolName, args, result, isError, status } = props;
  const { upsert } = useInspector();
  const startedAtRef = useRef<number | null>(null);

  const phase: "running" | "ok" | "error" =
    status.type === "running"
      ? "running"
      : isError || status.type === "incomplete"
        ? "error"
        : "ok";

  useEffect(() => {
    if (startedAtRef.current == null) {
      startedAtRef.current = performance.now();
      upsert({
        id: toolCallId,
        name: toolName,
        status: "running",
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        startedAt: startedAtRef.current,
        latency: null,
        sizeIn: byteLen(args),
        sizeOut: 0,
        input: args,
      });
      return;
    }
    if (phase !== "running") {
      const lat =
        startedAtRef.current != null
          ? Math.round(performance.now() - startedAtRef.current)
          : null;
      upsert({
        id: toolCallId,
        name: toolName,
        status: phase,
        latency: lat,
        sizeOut: byteLen(result),
        output: result,
        error:
          phase === "error" && status.type === "incomplete"
            ? String(status.error ?? "tool error")
            : phase === "error"
              ? "tool reported an error"
              : undefined,
      });
    }
  }, [phase, toolCallId, toolName, args, result, status, upsert]);

  return null; // invisible
}
