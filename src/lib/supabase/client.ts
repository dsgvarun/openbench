"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser Supabase client. Uses the anon key + RLS — never sees data the policies forbid.
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
