# Walmart GT MCP Showcase — Build Brief

> **For the AI agent reading this:** build the entire app from this brief in one
> pass. All technical references, design specs, and acceptance criteria are
> self-contained below. When you finish, the user should be able to `npm install
> && npm run dev` and hit a working chatbot at `localhost:3000`.

---

## 1. What we're building

A chat application that **demonstrates a live Model Context Protocol (MCP) server
in action** against Walmart Guatemala's real storefront. The product is
intentionally a *showcase*: the goal isn't to replace walmart.com.gt, it's to
make the MCP **visible** — every tool call should be seen, traced, and admired.

A recruiter typing *"find me the cheapest paracetamol under Q50"* should watch
the agent:

1. Call `autocomplete("paracetamol")` → see suggestions appear
2. Call `search_products(query, price_max=50)` → see filtered results stream in
3. Compose a Spanish response with prices and clickable links

**The tool calls are the show.** Optimize the UI to make them prominent.

---

## 2. Success criteria

- [ ] Walmart-branded UI (blue/yellow), looks like a real Walmart product
- [ ] Chat works end-to-end against the live MCP at `https://abrahaamveliz-myspace.hf.space/mcp`
- [ ] Every MCP tool call is rendered inline as it happens (not hidden in a console)
- [ ] A side "MCP Inspector" panel logs every JSON-RPC call with timing
- [ ] Spanish-first copy with English fallback when the user types English
- [ ] Mobile-responsive (single-column with collapsible inspector drawer)
- [ ] Deploys cleanly to Vercel free tier with three env vars
- [ ] No login required — public link works for anyone

---

## 3. Visual identity

### Palette

| Role | Hex | Notes |
| --- | --- | --- |
| Walmart Blue | `#0071CE` | Header, primary CTAs, user message bubbles |
| Walmart Blue (dark) | `#004F9A` | Header gradient, hover states |
| Walmart Yellow | `#FFC220` | Accent, send button, "spark" highlights |
| Spark Green | `#76B900` | Tool-call success state, "ran" indicators |
| Warm white | `#FFFDF7` | Page background (warmer than pure white) |
| Card white | `#FFFFFF` | Chat panel, inspector cards |
| Text primary | `#1F2937` | Body text |
| Text muted | `#6B7280` | Timestamps, latencies, captions |
| Border | `#E5E7EB` | Subtle dividers |
| Tool card bg | `#F9FAFB` | Slightly darker than card-white |
| Error red | `#DC2626` | Tool errors |

### Typography

- **Sans body**: Inter (via `next/font/google`), 400 / 500 / 600 weights
- **Display**: Inter, 700, used for headings and the empty-state hero
- **Mono**: JetBrains Mono (or `ui-monospace` system stack) for JSON / tool-call code

### Brand mark

Walmart's wordmark + spark icon. In the header:

```
✦ Walmart       GT MCP demo
```

- Spark icon `✦` rendered in `#FFC220` (yellow), 24px
- "Walmart" in white, 700 weight, slightly tighter tracking
- Subtitle "GT MCP demo" in white at 60% opacity, 400 weight, 12px

If the AI builder can't render the spark cleanly, use an SVG: 6-pointed yellow spark / asterisk centered at baseline.

### Tone of voice

- **Spanish-primary**. Default UI copy in Spanish. Examples:
  - Empty state: "Hola, soy Wally. ¿Qué buscas hoy en Walmart Guatemala?"
  - Composer placeholder: "Pregunta por cualquier producto…"
  - Inspector header: "Llamadas MCP en tiempo real"
- **English fallback** if the user types English — the LLM handles this; the UI doesn't need a toggle.
- Friendly, terse. Never "I am an AI assistant designed to..." — just answer.

---

## 4. Layout

### Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────┐
│  ✦ Walmart  GT MCP demo                       [docs] [github]    │  ← header (60px, blue)
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────┐ ┌───────────────────────┐  │
│   │                                 │ │  Inspector            │  │
│   │   Chat thread                   │ │  ─────────────────    │  │
│   │   • messages                    │ │  search_products  ✓  │  │
│   │   • tool cards inline           │ │  324ms                │  │
│   │                                 │ │                       │  │
│   │                                 │ │  list_categories  ✓  │  │
│   │                                 │ │  198ms                │  │
│   │                                 │ │                       │  │
│   │   [composer ▸ ]                 │ │                       │  │
│   └─────────────────────────────────┘ └───────────────────────┘  │
│   max-w 720px                          width 360px               │
└──────────────────────────────────────────────────────────────────┘
```

- Two-column layout. Chat ~70% width, inspector ~30%.
- Chat thread is centered with a `max-width: 720px` content column.
- Inspector is sticky on the right.
- Page bg `#FFFDF7`, both cards `#FFFFFF` with `box-shadow: 0 1px 3px rgba(0,0,0,0.05)`.

### Mobile (< 1024px)

- Single-column chat
- Floating button at bottom-right: "MCP (3)" badge with count of calls
- Tap → bottom drawer slides up with the inspector

---

## 5. Components in detail

### 5.1 Header

```
60px tall, full width
background: linear-gradient(90deg, #0071CE 0%, #004F9A 100%)
padding: 0 24px
```

Left: logo + subtitle. Right: text links to "docs" (this brief) and "github" (the source repo). No menu, no auth, no nav.

### 5.2 Empty state (no messages yet)

Centered in the chat panel, vertical:

```
                ✦
       (large yellow spark, 64px)

      Hola, soy Wally
      (Inter 700, 32px, #1F2937)

  Tu asistente de compras para
       Walmart Guatemala
   (Inter 400, 16px, #6B7280)


[¿paracetamol más barato?]  [pañales bajo Q200]
[lista de categorías]       [Huggies Natural Care]
       (suggestion chips)
```

Suggestion chips: rounded-full pills, `bg-#FFFFFF`, `border-#E5E7EB`, `hover:border-#0071CE`. Clicking populates the composer and submits.

### 5.3 Chat messages

**User message**:
- Right-aligned
- `bg-#0071CE`, `color-white`, rounded-2xl, padding `12px 16px`
- Max width 80%

**Assistant message**:
- Left-aligned, no bubble
- Plain prose, `color-#1F2937`
- Links in `#0071CE` underlined
- Inline tool cards (next section) appear *between* the user message and the final assistant text
- Markdown rendering (use `react-markdown` + `remark-gfm`)

### 5.4 Tool call card (the centerpiece — get this right)

Rendered inline in the assistant turn. Each card is one MCP tool call.

**Collapsed (default for first call, expanded later)**:

```
┌──────────────────────────────────────────────────┐
│  ⚙  search_products      ✓ 324ms          [▾]   │
└──────────────────────────────────────────────────┘
```

- Border `#E5E7EB`, bg `#F9FAFB`, rounded-xl, padding `12px 16px`
- Gear icon (`⚙` or lucide `Wrench`) on the left
- Tool name in `font-mono`, 14px, `#1F2937`
- Status icon: spinning gear (calling) → green check `✓` `#76B900` (done) → red `✗` `#DC2626` (error)
- Latency on the right, `font-mono`, 12px, `#6B7280`
- Chevron toggle to expand

**Expanded**:

```
┌──────────────────────────────────────────────────┐
│  ⚙  search_products      ✓ 324ms          [▴]   │
├──────────────────────────────────────────────────┤
│  → Input                                         │
│  ┌──────────────────────────────────────────┐    │
│  │ {                                        │    │
│  │   "query": "paracetamol",                │    │
│  │   "price_max": 50,                       │    │
│  │   "start": 0, "end": 4                   │    │
│  │ }                                        │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ← Output  (4 results)              [Copy JSON]  │
│  ┌──────────────────────────────────────────┐    │
│  │ • Tylenol 500mg cápsulas — Q76.70        │    │
│  │ • Vick Vitapyrena 5 sobres — Q15.50      │    │
│  │ • …  (collapsible)                       │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

- Input shown as syntax-highlighted JSON (use `prismjs` or `shiki`)
- Output shown as a smart summary first (top 3 items as a bulleted list, with a "show raw JSON" toggle that reveals the full JSON-RPC payload)
- "Copy JSON" button on the output

**Live state machine** (based on AI SDK 6 tool UI parts):
- `input-streaming` / `input-available` → calling spinner
- `output-available` → check, render summary
- `output-error` → red icon, render `errorText`

### 5.5 MCP Inspector sidebar

A live ledger of every JSON-RPC call to the MCP, in reverse chronological order (newest at top).

```
┌─ Inspector ──────────────────────────────┐
│  Llamadas MCP                  [filter ▾]│
├──────────────────────────────────────────┤
│                                          │
│  10:42:18  search_products       ✓ 324ms │
│  10:42:14  autocomplete          ✓ 187ms │
│  10:41:50  list_categories       ✓ 412ms │
│                                          │
└──────────────────────────────────────────┘
```

Each row, when clicked, expands to show:
- Full JSON-RPC request body
- Full JSON-RPC response body
- HTTP status, request size, response size
- Two buttons: "Copy as cURL", "Copy raw"

Filter dropdown: filter by tool name. "All" by default.

Use `useEffect` + a global event emitter (or React context) to push entries each time a tool call enters `output-available` or `output-error` state.

Empty state: "Aún no hay llamadas. Pregúntale algo a Wally para verlas en vivo."

### 5.6 Composer

- Bottom-fixed within the chat panel, not the page
- Pill shape: `bg-white`, `border-#E5E7EB`, `rounded-full`, padding `8px 16px`
- Textarea grows up to 6 lines, then scrolls
- Send button: round 36px, `bg-#FFC220`, dark icon, `hover:scale-105`
- On focus: `border-#0071CE`

Above the composer when no messages yet: 4 suggestion chips (see empty state).

### 5.7 Footer (small, below composer)

Tiny line of links/text:

```
walmart-gt-mcp · 9 tools · powered by Gemini 2.5 Flash · view source on GitHub
```

`text-xs`, `text-#6B7280`, links in `#0071CE`.

---

## 6. Sample user flows

The AI builder should manually verify these flows after building:

**Flow 1: Cheapest paracetamol**
- User: "¿cuál es el paracetamol más barato?"
- Agent: calls `autocomplete("paracetamol")` → calls `search_products(query="paracetamol", end=10, order_by="OrderByPriceASC")` → answers with cheapest 3-4 products with prices and links.
- Inspector shows 2 calls.

**Flow 2: Categories**
- User: "list categories"
- Agent: calls `list_categories(depth=1)` → answers with the 26 top-level categories in Spanish.
- Inspector shows 1 call.

**Flow 3: Filtered search**
- User: "Huggies Natural Care under Q300"
- Agent: calls `autocomplete("Huggies Natural")` → calls `search_products(query=..., price_max=300)` → answers.

**Flow 4: Error handling**
- (Simulate by using a wrong arg.) The tool card should turn red, show the error, and the agent should retry with simpler args once.

---

## 7. Tech stack (use exactly this)

| Concern | Library | Version |
| --- | --- | --- |
| Framework | Next.js | 16+ (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 (with `@plugin "@tailwindcss/typography"`) |
| UI primitives | `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` | latest |
| AI SDK | `ai` | 6.x |
| LLM provider | `@ai-sdk/google` (Gemini) | 3.x |
| MCP client | `@ai-sdk/mcp` + `@modelcontextprotocol/sdk` | latest |
| Markdown | `react-markdown` + `remark-gfm` | latest |
| Code highlight | `shiki` (lighter) or `prismjs` | latest |
| Icons | `lucide-react` | latest |
| Fonts | `next/font/google` (Inter, JetBrains Mono) | — |

Install command:

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk \
            ai @ai-sdk/google @ai-sdk/mcp @modelcontextprotocol/sdk \
            react-markdown remark-gfm lucide-react shiki \
            @tailwindcss/typography zod
```

---

## 8. Environment variables

Create `.env.local` with:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=<get free at https://aistudio.google.com/apikey>
GEMINI_MODEL=gemini-2.5-flash

WALMART_MCP_URL=https://abrahaamveliz-myspace.hf.space/mcp
WALMART_MCP_API_KEY=wmgt_MLAIfo0kApgmtoBQnRsWA2MfIFBaDMjjtLc09zqmga4
```

Make sure `.env.example` exists with the same keys but blank values for the secrets, and that `.env.local` is gitignored (Next.js default already does this).

---

## 9. The chat API route

`app/api/chat/route.ts`:

```ts
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const maxDuration = 60;

const SYSTEM = `[see Wally system prompt below]`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.WALMART_MCP_URL!),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${process.env.WALMART_MCP_API_KEY!}` },
      },
    },
  );

  const mcpClient = await experimental_createMCPClient({ transport });
  const tools = await mcpClient.tools();

  // CRITICAL: convertToModelMessages is ASYNC in AI SDK 6 — must await
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system: SYSTEM,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
    onFinish: async () => { await mcpClient.close(); },
  });

  return result.toUIMessageStreamResponse();
}
```

---

## 10. Wally system prompt

```
You are Wally, a shopping assistant for Walmart Guatemala (walmart.com.gt).
Help users find products, compare prices, and discover deals using LIVE catalog
data via MCP tools.

# Tools
ALWAYS call the Walmart MCP tools for any product, price, or category claim —
never invent or recall them.

- Typed query → search_products with the user's term.
- Broad exploration → list_categories, then browse_category.
- Specific known product → autocomplete to refine, then search_products or
  get_product_by_slug.
- Discover valid brand IDs / price buckets → get_facets before filtering.
- The catalog is Spanish-only. If the user types in English, translate the
  search term to Spanish before calling tools (e.g. "diapers" → "pañales",
  "milk" → "leche").

# Response format
- Reply in the user's language (Spanish or English).
- Prices: "Q##.##" (Quetzales).
- For each product show: name, brand, price, and a clickable Markdown link.
- Default to 4–6 results in a numbered list. Offer "show more".
- Include the image URL when helpful.

# Behavior
- Be concise. No filler.
- For vague briefs, either ask ONE focused question OR pick a reasonable
  default and tell the user what you assumed.
- When prices vary widely, call out the cheapest and a mid-range pick.
- If a tool errors, retry once with simpler args; if it still fails, say so
  plainly and suggest a next step.
- Never claim a product is in stock — only report what the tool returns
  (availableQuantity).
```

---

## 11. MCP reference (full)

The MCP server is already deployed and live. **Do not re-implement it.** Just
call it.

### Endpoint

```
URL:    https://abrahaamveliz-myspace.hf.space/mcp
Auth:   Authorization: Bearer wmgt_MLAIfo0kApgmtoBQnRsWA2MfIFBaDMjjtLc09zqmga4
Protocol: JSON-RPC 2.0 over Streamable HTTP (POST per request, stateless)
```

Liveness probe (no auth): `GET https://abrahaamveliz-myspace.hf.space/`

### Tool list

#### `search_products(query?, category?, brand_id?, price_min?, price_max?, start=0, end=19, order_by="OrderByScoreDESC")`

Full-text search with optional filters. At least one of `query` or `category`
should be supplied.

| Arg | Type | Notes |
| --- | --- | --- |
| `query` | string? | Spanish search term ("paracetamol", "leche") |
| `category` | string? | Top-level category slug ("farmacia", "lacteos") |
| `brand_id` | int? | From `list_brands` |
| `price_min` | float? | GTQ (Quetzales) |
| `price_max` | float? | GTQ |
| `start` | int | 0-based pagination start (default 0) |
| `end` | int | Inclusive end. Max window 50 items |
| `order_by` | string | `OrderByScoreDESC` (default), `OrderByPriceASC`, `OrderByPriceDESC`, `OrderByTopSaleDESC`, `OrderByReleaseDateDESC`, `OrderByNameASC`, `OrderByNameDESC`, `OrderByBestDiscountDESC` |

**Returns**:
```json
{
  "total": 4,
  "start": 0,
  "end": 2,
  "products": [
    {
      "productId": "36637",
      "ean": "...",
      "name": "Paracetamol Tylenol 500 mg caja 50 cápsulas",
      "description": "...",
      "slug": "tylenol-extra-fuerte-50-capsulas",
      "brand": "TYLENOL",
      "brandId": 123,
      "categoryId": "...",
      "categories": [...],
      "sellingPrice": 76.70,
      "listPrice": 76.70,
      "priceWithoutDiscount": 76.70,
      "availableQuantity": 999,
      "images": [{"imageUrl": "...", "imageText": "..."}],
      "specifications": [...],
      "skus": [...],
      "link": "https://www.walmart.com.gt/tylenol-extra-fuerte-50-capsulas/p"
    }
  ]
}
```

#### `browse_category(category_path, brand_id?, price_min?, price_max?, start=0, end=19, order_by)`

Browse products in a category (no search term). Supports nested paths via slashes:
`farmacia`, `farmacia/otc`, `lacteos/yogurt`.

#### `count_products(query?, category?, brand_id?, price_min?, price_max?) → int`

Just the total match count for a query/filter combo. Useful for pagination.

#### `get_product_by_slug(slug) → product | null`

Fetch one product by its URL slug (`linkText`). Returns the same shape as items
in `search_products.products`.

#### `get_product_by_id(product_id: int) → product | null`

Fetch one product by VTEX productId.

#### `list_categories(depth=3) → category[]`

Full category tree.

```json
[
  {
    "id": 1,
    "name": "Abarrotes",
    "slug": "abarrotes",
    "hasChildren": true,
    "url": "https://www.walmart.com.gt/abarrotes",
    "children": [...]
  },
  ...
]
```

#### `list_brands(name_contains?, active_only=true, limit=50)`

Returns `{ total, returned, brands: [{id, name, isActive}, ...] }`. Full list is
~6,400 brands — always pass `name_contains` unless you really need the dump.

#### `get_facets(query?, category?)`

Available filters for a search context.

```json
{
  "brands": [{"id": 123, "name": "TYLENOL", "quantity": 1}],
  "priceRanges": [{"slug": "...", "name": "Q0 - Q50", "quantity": 12}],
  "specificationFilters": [...],
  "categoriesTrees": [...]
}
```

#### `autocomplete(term) → suggestion[]`

```json
[
  {"term": "paracetamol", "count": 6},
  {"term": "panceta", "count": 90}
]
```

### JSON-RPC examples

**List tools**:
```bash
curl -X POST https://abrahaamveliz-myspace.hf.space/mcp \
  -H 'Authorization: Bearer wmgt_MLAIfo0kApgmtoBQnRsWA2MfIFBaDMjjtLc09zqmga4' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Call a tool**:
```bash
curl -X POST https://abrahaamveliz-myspace.hf.space/mcp \
  -H 'Authorization: Bearer wmgt_MLAIfo0kApgmtoBQnRsWA2MfIFBaDMjjtLc09zqmga4' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{
      "name":"search_products",
      "arguments":{"query":"paracetamol","start":0,"end":4}
    }
  }'
```

### Notes / gotchas

- Tools that return arrays put each item as a separate `content[i]` text block. Use
  `result.structuredContent.result` for clean parsing.
- Prices in GTQ.
- The catalog is Spanish-only; users typing English should be translated by the
  agent before calling tools.

---

## 12. Acceptance checklist

Before declaring done, verify each of these manually:

- [ ] `npm run dev` starts cleanly
- [ ] Hitting `/` shows the empty state with hero + 4 chips
- [ ] Clicking a chip populates the composer and submits
- [ ] First user message triggers a visible tool call card *in* the chat
- [ ] Tool card shows: spinner → check + latency
- [ ] Inspector sidebar (right panel desktop / drawer mobile) populates with each call
- [ ] Each inspector entry expands to show full JSON-RPC payload
- [ ] Errors (force one by stopping the MCP) render red and the agent retries
- [ ] On mobile (<1024px) inspector becomes a bottom drawer with a count badge
- [ ] Spanish prompt → Spanish response. English prompt → English response.
- [ ] Prices formatted as `Q##.##`
- [ ] Product links are real walmart.com.gt URLs that open in a new tab
- [ ] Fully responsive at 360px, 768px, 1024px, 1440px breakpoints
- [ ] No console errors in dev tools
- [ ] No unused dependencies in package.json
- [ ] Vercel deploy works end-to-end with the three env vars set

---

## 13. Stretch goals (only if time)

- **Replay link**: each chat gets a UUID; sharing the link replays the prompts (no LLM call). Good for portfolio links to specific demos.
- **"Suggested next" chips after each response**: agent emits 2-3 follow-up questions, rendered as pills below the assistant message.
- **Latency sparkline** in the inspector header: rolling avg of the last 10 calls.
- **Image-grid output mode**: when a tool returns products with images, render them as a 2x3 grid card instead of a numbered list.

---

## 14. Out of scope

- Authentication (anonymous public demo)
- Persistence (no DB; conversations are ephemeral)
- Chat history / multi-thread (single-thread per session)
- Walmart cart / checkout integration (it's a demo, not a store)
- Internationalization beyond Spanish/English bilingual handling done by the LLM

---

## 15. Deploy

After build:

```bash
git init
git add -A
git commit -m "feat: initial walmart gt mcp showcase"
gh repo create walmart-gt-mcp-showcase --public --source=. --push
```

Then on Vercel:
1. https://vercel.com/new → import the repo
2. Add the 3 env vars (see §8)
3. Deploy

The `app/api/chat` route uses streaming SSE which Vercel supports natively. No
extra config needed.

---

**End of brief. Build it.**
