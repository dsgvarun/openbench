import type { EmailClient } from "./client";

// Intro-email delivery logic (Phase 4.4). Crash-safety comes from the DB state machine:
// a reveal is 'pending' until both intros send, then 'delivered' (or 'failed' to retry
// next run). Idempotent — only pending reveals are ever processed.

export interface PendingReveal {
  id: string;
  candidateEmail: string;
  candidateName: string;
  companyName: string;
  seatEmails: string[];
  role: string;
}

export interface RevealStore {
  pending(limit: number): Promise<PendingReveal[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

function candidateEmail(r: PendingReveal) {
  return {
    to: r.candidateEmail,
    subject: `${r.companyName} wants to talk — you accepted`,
    html: `<p>You accepted ${r.companyName}'s interest for <strong>${r.role}</strong>. They now have your profile and will reach out. We've shared their team contact with you separately.</p>`,
  };
}

function seatEmail(r: PendingReveal, to: string) {
  return {
    to,
    subject: `${r.candidateName} accepted your interest — ${r.role}`,
    html: `<p><strong>${r.candidateName}</strong> accepted your interest for <strong>${r.role}</strong>. Their full profile and contact details are now on OpenBench. Reach out directly.</p>`,
  };
}

export async function processIntroEmails(
  store: RevealStore,
  email: EmailClient,
  limit = 50,
): Promise<{ processed: number; delivered: number; failed: number }> {
  const pending = await store.pending(limit);
  let delivered = 0;
  let failed = 0;

  for (const r of pending) {
    const results = await Promise.all([
      email.send(candidateEmail(r)),
      ...r.seatEmails.map((to) => email.send(seatEmail(r, to))),
    ]);
    if (results.every((x) => x.ok)) {
      await store.markDelivered(r.id);
      delivered++;
    } else {
      // Leave for the next run to retry (still 'pending' semantically via 'failed' flag).
      await store.markFailed(r.id);
      failed++;
    }
  }
  return { processed: pending.length, delivered, failed };
}
