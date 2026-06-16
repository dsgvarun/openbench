"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processIntroEmails } from "@/lib/email/intro";
import { adminRevealStore } from "@/lib/email/reveal-store";
import { ResendEmailClient } from "@/lib/email/client";

// Thin wrappers over the reveal-loop RPCs (Phase 4). The RPCs enforce every invariant
// (rate limits, idempotent accept, race rejection) atomically in the database — these
// actions just call them and surface the typed result to the UI.

type RpcResult = { ok: boolean; error?: string; interest_id?: string };

export async function sendInterest(input: { candidateId: string; listingId: string; note?: string }): Promise<RpcResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_interest", {
    p_candidate: input.candidateId,
    p_listing: input.listingId,
    p_note: input.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return data as RpcResult;
}

export async function acceptInterest(interestId: string): Promise<RpcResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_interest", { p_interest: interestId });
  if (error) return { ok: false, error: error.message };
  const result = data as RpcResult;

  // Send the intro email immediately after the response (best-effort, non-blocking).
  // Needs SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY; if either is absent it no-ops and
  // the daily cron (/api/jobs/intro-emails) retries any still pending/failed.
  if (result.ok) {
    after(async () => {
      try {
        await processIntroEmails(adminRevealStore({ interestId }), new ResendEmailClient(), 1);
      } catch {
        /* daily cron backstop will retry */
      }
    });
  }
  return result;
}

export async function declineInterest(interestId: string, reason?: string): Promise<RpcResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decline_interest", {
    p_interest: interestId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return data as RpcResult;
}
