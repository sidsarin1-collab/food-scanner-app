import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public and unauthenticated on purpose -- the header badge is visible to
// everyone, it just never reveals any suggestion detail before login.
//
// This route has no cookies()/headers() call to signal Next.js that it needs
// live evaluation, so without this it gets statically optimized at build time
// -- the count is queried once during `next build` and that single result is
// cached and served to every request afterward, forever, regardless of what's
// actually in the database. Every other GET route in this app is exempted
// automatically because it calls isAuthedAdmin() (which reads cookies()); this
// one needs the opt-out spelled out explicitly.
export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.suggestedChemical.count();
  return NextResponse.json({ count });
}
