import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/jobs/auth";
import { ResendEmailClient } from "@/lib/email/client";
import { processIntroEmails } from "@/lib/email/intro";
import { adminRevealStore } from "@/lib/email/reveal-store";

export const dynamic = "force-dynamic";

// Daily backstop cron: send any reveal intros still pending/failed (e.g. the
// send-on-accept path failed, or RESEND_API_KEY was added after some reveals).
// Crash-safe via reveal.intro_delivery ('delivered' is terminal). Service-role only.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await processIntroEmails(adminRevealStore(), new ResendEmailClient());
  return NextResponse.json(result);
}
