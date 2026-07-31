import { useChat } from "@/lib/use-chat";

export function FollowupChips({
  suggestions,
}: {
  suggestions: { label: string; prompt: string }[];
}) {
  const { send, isStreaming } = useChat();

  if (suggestions.length === 0) return null;

  return (
    <div className="result-followups">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          className="chip-btn"
          onClick={() => send(s.prompt)}
          disabled={isStreaming}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}