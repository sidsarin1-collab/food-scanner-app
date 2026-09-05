// Single source of truth for the canonical domain. Set SITE_URL in the
// environment (Railway env vars for production, .env locally). Until the
// real domain is purchased, point this at whatever URL is actually serving
// the app -- switching it to the real domain later is a one-line env change,
// not a code change. No trailing slash.
const rawSiteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");
export const SITE_URL = rawSiteUrl || "http://localhost:3000";

// Kept OFF by default -- flip to "true" in the environment only after the
// real domain is purchased, DNS is pointed at Railway, and SITE_URL above is
// set to it. Turning this on while SITE_URL still points at a placeholder
// (or before DNS is live) would redirect real traffic into a dead end.
export const DOMAIN_REDIRECT_ENABLED = process.env.ENABLE_DOMAIN_REDIRECT?.trim().toLowerCase() === "true";
