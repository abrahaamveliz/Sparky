import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "./index.css";
import { App } from "./App";
import { LOGO_URL, PRODUCT_NAME } from "./lib/product-name";

// Swap favicon to the env-configured logo when set; fall back to the bundled
// /favicon.svg otherwise. Title is interpolated by Vite at build time, but
// re-set here so a hot env change is reflected without a rebuild.
if (LOGO_URL) {
  const link = document.getElementById("favicon");
  if (link instanceof HTMLLinkElement) {
    link.href = LOGO_URL;
    link.removeAttribute("type");
  }
}
document.title = `${PRODUCT_NAME} AI Shopping Assistant`;

// Reload should land at the top of the page with the video visible — not
// at whatever scroll position the user was at before. The browser's
// default ("auto") would restore the prior scroll, which fights our
// "show empty-state hero on reload" intent.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
