import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 15 middleware (becomes proxy.ts on a future Next 16 upgrade).
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase magic links that fall back to the Site-URL root land as /?code=… (success)
  // or /?error=… (expired). Forward them to our callback so login completes (or fails
  // gracefully) regardless of the redirect-allow-list config.
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("error"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Otherwise refresh the Supabase session cookie.
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
