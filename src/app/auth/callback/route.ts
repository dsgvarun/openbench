import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link / PKCE callback. Supabase redirects here from the email link with either
// ?code=<pkce> (success) or ?error=... (expired/invalid). We complete the session or
// bounce back to /signin with a friendly message — never a bare error page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const next = url.searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/me";

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) return NextResponse.redirect(new URL(dest, url.origin));
    return NextResponse.redirect(new URL("/signin?msg=link_failed", url.origin));
  }

  // Error path (e.g. otp_expired): send them back to request a fresh code.
  return NextResponse.redirect(new URL(`/signin?msg=${error ? "link_expired" : "link_failed"}`, url.origin));
}
