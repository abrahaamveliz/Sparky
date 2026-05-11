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

/** Strip every emoji / pictographic glyph from prose. The Walmart brand
 *  font (Everyday Sans Web) doesn't ship color emoji, and on Linux without
 *  Noto/Apple/Segoe emoji fonts installed, codepoints render as tofu
 *  boxes. The system prompt forbids the model from emitting emoji at all,
 *  but we strip defensively so a slip never reaches the user. We also
 *  drop variation selectors (U+FE0F) and zero-width joiners (U+200D) so
 *  multi-codepoint emoji (e.g. flags, families) don't leave fragments. */
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
function stripEmoji(s: string): string {
  return (
    s
      .replace(EMOJI_RE, "")
      // After stripping an emoji that lived inside markdown bold delimiters
      // ("**🛒 Title:**"), the leftover space breaks CommonMark's bold rule
      // ("opening ** must not be followed by whitespace"). Collapse the
      // post-** and pre-** spaces only when they neighbor real content, so
      // adjacent bold spans like "**a** **b**" are untouched.
      .replace(/\*\*[ \t]+(?=[^\s*])/g, "**")
      .replace(/(?<=[^\s*])[ \t]+\*\*(?=\s|$|[.,;:!?)])/g, "**")
      // Same shape for italic delimiters when they're a single asterisk.
      .replace(/(^|[\s(])\*[ \t]+(?=[^\s*])/g, "$1*")
      // Collapse runs of inner whitespace that the strip leaves behind.
      .replace(/[ \t]{2,}/g, " ")
  );
}

/** Strip triple-backtick code fences. The shopping assistant must NEVER
 *  emit code blocks — they're meant for snippets, not user-facing prose,
 *  and react-markdown renders them as monospace `<pre>` blocks that look
 *  like a debug leak. The system prompt forbids them, but we still see
 *  occasional slips (e.g. ```Plan de compra... or trailing ```json from a
 *  tool-arg dump). Strip every fence marker, both balanced (we keep the
 *  inner content as plain prose) and unbalanced (orphan opener at end of
 *  stream). Also strip "```language" lone tags. */
function stripCodeFences(s: string): string {
  return (
    s
      // Lone fence-line at start/end of a paragraph (e.g. ```json on its
      // own line). Drop the line entirely, including the trailing newline.
      .replace(/^[ \t]*`{3,}\w*[ \t]*\n?/gm, "")
      // Inline ``` clusters anywhere else (e.g. ```Plan de compra...).
      .replace(/`{3,}\w*/g, "")
  );
}

/** Insert a space when the model emits "**word**next" without a space
 *  between the closing bold and the following word — react-markdown then
 *  renders the whole thing as one mashed token visually. We only match
 *  when there's a complete `**X**` span immediately followed by a
 *  Unicode letter; that disambiguates from the `text**bold**` pattern
 *  where the leading `**` would be an opening delimiter. */
function repairBoldSpacing(s: string): string {
  return s.replace(/\*\*([^*\n]+?)\*\*([\p{L}])/gu, "**$1** $2");
}

/** Collapse runs of leading/trailing whitespace and 3+ consecutive blank
 *  lines down to one. The LLM occasionally emits bursts of `\n` between
 *  tool calls during streaming (a quirk of the prompt-engineered tool
 *  format) which would otherwise render as a giant gap. Also truncates
 *  at any synthetic tool-format markers that leaked past the proxy. */
function tidy(s: string): string {
  return repairBoldSpacing(stripCodeFences(stripEmoji(stripLeaks(s))))
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
