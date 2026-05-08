// Single source of truth for the assistant's display name + logo on the client.
// Configured via VITE_PRODUCT_NAME and VITE_LOGO_URL in .env.local. Both are
// optional — name defaults to "Wally", logo URL is empty (falls back to the
// static favicon at /favicon.svg).
export const PRODUCT_NAME =
  (import.meta.env.VITE_PRODUCT_NAME as string | undefined)?.trim() || "Wally";

export const LOGO_URL =
  (import.meta.env.VITE_LOGO_URL as string | undefined)?.trim() || "";

// Optional URLs for the three illustrative icons shown in the delivery
// popover. Each falls back to empty string; the popover hides the slot when
// empty so the layout doesn't break.
export const NAV_BAR_ASSET_1 =
  (import.meta.env.VITE_NAV_BAR_ASSET_1 as string | undefined)?.trim() || "";
export const NAV_BAR_ASSET_2 =
  (import.meta.env.VITE_NAV_BAR_ASSET_2 as string | undefined)?.trim() || "";
export const NAV_BAR_ASSET_3 =
  (import.meta.env.VITE_NAV_BAR_ASSET_3 as string | undefined)?.trim() || "";

// Avatar shown next to assistant messages in the chat. Falls back to the
// inline Spark SVG when empty.
export const AGENT_AVATAR_URL =
  (import.meta.env.VITE_AGENT_AVATAR_URL as string | undefined)?.trim() || "";

// Hero banner illustration. Falls back to nothing (the banner section is
// hidden) when empty.
export const BANNER_1 =
  (import.meta.env.VITE_BANNER_1 as string | undefined)?.trim() || "";
