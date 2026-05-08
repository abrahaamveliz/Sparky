import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markers that signal the OCR Arena prompt-engineered tool format has
 *  leaked through the proxy's ToolUseStripper. When we see one, the rest
 *  of the prose is synthetic tool-result junk — truncate at the marker. */
const LEAK_MARKERS = [
  /\n?H:\s*<[^>]+>/, // "H: <tool_result>..." turn marker
  /\n?A:\s*<[^>]+>/, // "A: <...>" turn marker
  /<tool_result[\s>]/, // raw <tool_result ...>
  /<\w+_results?>/, // <search_products_results>, <tool_input_result>, etc.
  /\n?<tool_use[\s>]/, // un-stripped tool_use opener
];

function stripLeaks(s: string): string {
  let earliest = s.length;
  for (const re of LEAK_MARKERS) {
    const m = s.match(re);
    if (m && m.index !== undefined && m.index < earliest) {
      earliest = m.index;
    }
  }
  return s.slice(0, earliest);
}

/** Collapse runs of leading/trailing whitespace and 3+ consecutive blank
 *  lines down to one. The LLM occasionally emits bursts of `\n` between
 *  tool calls during streaming (a quirk of the prompt-engineered tool
 *  format) which would otherwise render as a giant gap. Also truncates
 *  at any synthetic tool-format markers that leaked past the proxy. */
function tidy(s: string): string {
  return stripLeaks(s)
    .replace(/^\s+/, "")
    .replace(/\s+$/, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function Prose({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ol: ({ ...props }) => <ol className="prose-ol" {...props} />,
          a: ({ ...props }) => (
            <a target="_blank" rel="noreferrer" {...props} />
          ),
        }}
      >
        {tidy(children)}
      </ReactMarkdown>
    </div>
  );
}
