import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL, DOMAIN_REDIRECT_ENABLED } from "@/lib/siteConfig";

function normalizeHost(host: string | null | undefined): string {
  // Strip a port suffix and lowercase -- a request reaching the app through
  // multiple proxy hops (Cloudflare -> Railway edge -> Next.js) can present
  // the host differently across sources (Host header, X-Forwarded-Host,
  // NextURL's own reconstruction), and a spurious mismatch here means an
  // infinite self-redirect: this exact bug took the site down once already.
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

// Inactive by default (see siteConfig.ts) -- once the real domain is bought,
// DNS points at Railway, and SITE_URL is set to it, flip
// ENABLE_DOMAIN_REDIRECT=true in the environment to start 301-redirecting
// the legacy Railway *.up.railway.app URL to the canonical domain, so search
// engines don't index both as duplicate content.
//
// Deliberately an ALLOWLIST, not "redirect anything that isn't canonical":
// an earlier denylist version took the site down with an infinite redirect
// loop on the canonical domain itself, because a request reaching the app
// through multiple proxy hops (Cloudflare -> Railway edge -> Next.js) can
// present the host differently across sources (Host header,
// X-Forwarded-Host, NextURL's own reconstruction) -- a wrong "this isn't the
// canonical host" verdict on the canonical domain itself is exactly what
// caused that outage. Only redirect when we're sure it's the specific
// legacy host; do nothing for every other case, canonical or not.
export function middleware(request: NextRequest) {
  if (!DOMAIN_REDIRECT_ENABLED) return NextResponse.next();

  const candidateHosts = [
    request.nextUrl.host,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].map(normalizeHost);

  const isLegacyRailwayHost = candidateHosts.some((h) => h.endsWith(".up.railway.app"));
  if (!isLegacyRailwayHost) return NextResponse.next();

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
  return NextResponse.redirect(target, 301);
}

export const config = {
  // Skip Next internals and static assets -- no reason to redirect those,
  // and redirecting API routes could break server-to-server calls that hit
  // the Railway host directly.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
