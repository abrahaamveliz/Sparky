/**
 * Production server. Serves the built Vite client from ./dist and exposes
 * the same /api/chat handler we use in dev. Listens on PORT (default 7860,
 * which is the Hugging Face Spaces convention).
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
dotenvConfig();

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 7860;
const HOST = process.env.HOST || "0.0.0.0";
const DIST = path.join(__dirname, "dist");

const app = express();

app.post("/api/chat", async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  const url = `http://${req.headers.host || "localhost"}${req.url}`;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: body.length > 0 ? body : undefined,
  });

  const response = await handler(request);
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));

  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
});

app.use(express.static(DIST, { index: false }));

// SPA fallback: any non-API GET serves index.html
app.use((req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
