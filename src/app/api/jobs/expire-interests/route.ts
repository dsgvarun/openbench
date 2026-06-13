import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/jobs/auth";

export const dynamic = "force-dynamic";

// Cron job: expire interest requests past their 14-day window (Phase 5).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_stale_interests");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expired: data ?? 0 });
}
