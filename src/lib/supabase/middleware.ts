import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on each request and rewrites the cookies.
// Standard @supabase/ssr pattern. No-ops in demo mode (no Supabase env).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!env.supabaseUrl || !env.supabaseAnonKey) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: CookieToSet) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch the session so it refreshes and the cookie is rewritten.
  await supabase.auth.getUser();
  return response;
}
