"use server";

import { createClient } from "@/lib/supabase/server";

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
  // TODO(key): the intro email is queued off reveal.intro_delivery='pending' via Resend
  // (Phase 4.4) — a worker reads pending reveals, sends, and flips delivery status.
  return data as RpcResult;
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
