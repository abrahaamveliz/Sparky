/**
 * Tiny Express wrapper that exposes /api/* as the same Web-Standard handlers
 * Vercel uses in production. Lets `vite dev` proxy to localhost:8787 and get
 * identical behavior to the deployed build.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
dotenvConfig(); // also pick up .env if present, without overriding .env.local

import express from "express";
import handler from "./api/chat.js";

const app = express();
const PORT = 8787;

app.post("/api/chat", async (req, res) => {
  // Read body as raw bytes so we can pass through to Web Request unchanged.
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);

  const url = `http://localhost:${PORT}${req.url}`;
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

app.listen(PORT, () => {
  console.log(`[dev-server] /api ready on http://localhost:${PORT}`);
});
