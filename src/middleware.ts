import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL, DOMAIN_REDIRECT_ENABLED } from "@/lib/siteConfig";

// Inactive by default (see siteConfig.ts) -- once the real domain is bought,
// DNS points at Railway, and SITE_URL is set to it, flip
// ENABLE_DOMAIN_REDIRECT=true in the environment to start 301-redirecting
// any other host (the Railway *.up.railway.app URL included) to the
// canonical domain, so search engines don't index both as duplicate content.
export function middleware(request: NextRequest) {
  if (!DOMAIN_REDIRECT_ENABLED) return NextResponse.next();

  const canonicalHost = new URL(SITE_URL).host;
  if (request.nextUrl.host === canonicalHost) return NextResponse.next();

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
  return NextResponse.redirect(target, 301);
}

export const config = {
  // Skip Next internals and static assets -- no reason to redirect those,
  // and redirecting API routes could break server-to-server calls that hit
  // the Railway host directly.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
