/**
 * One-shot script: connect to the Walmart GT MCP, call list_categories, dump
 * the result to stdout as JSON. Pipe to a file and import it statically:
 *
 *   tsx scripts/fetch-categories.ts > src/lib/walmart-categories.json
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.WALMART_MCP_URL;
const MCP_KEY = process.env.WALMART_MCP_API_KEY;

if (!MCP_URL) {
  console.error("WALMART_MCP_URL missing in .env.local");
  process.exit(1);
}

const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
  requestInit: {
    headers: MCP_KEY ? { Authorization: `Bearer ${MCP_KEY}` } : {},
  },
});

const client = new Client(
  { name: "categories-fetcher", version: "1.0.0" },
  { capabilities: {} },
);

await client.connect(transport);

// Print the tool list to stderr so we can see what the MCP exposes.
const toolList = await client.listTools();
console.error(
  "tools:",
  toolList.tools.map((t) => t.name).join(", "),
);

// Try a few likely names; first success wins.
const candidates: { name: string; args: Record<string, unknown> }[] = [
  { name: "list_categories", args: { depth: 3 } },
  { name: "list_categories", args: {} },
  { name: "get_category_tree", args: {} },
  { name: "categories", args: {} },
];

let last: unknown = null;
for (const c of candidates) {
  try {
    const result = await client.callTool({ name: c.name, arguments: c.args });
    console.error(`called: ${c.name}(${JSON.stringify(c.args)})`);
    last = result;
    break;
  } catch (e) {
    console.error(`failed ${c.name}:`, (e as Error).message);
  }
}

if (!last) {
  console.error("no candidate succeeded");
  await client.close();
  process.exit(2);
}

console.log(JSON.stringify(last, null, 2));
await client.close();
