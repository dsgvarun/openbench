"use client";

import { useState } from "react";
import { BAND_LABEL } from "@/lib/bands";
import type { DemoRequest } from "@/lib/demo";

type Status = "pending" | "accepted" | "declined";

// Candidate reveal inbox. Accept opens the one-way-door confirmation (irrevocability +
// scoped-purge copy). In demo mode it resolves locally; with a DB it calls the RPCs.
export function RevealInbox({ requests, demo }: { requests: DemoRequest[]; demo: boolean }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(Object.fromEntries(requests.map((r) => [r.id, "pending"])));
  const [confirming, setConfirming] = useState<DemoRequest | null>(null);

  const set = (id: string, s: Status) => setStatuses((m) => ({ ...m, [id]: s }));

  return (
    <div className="space-y-4">
      {demo && (
        <p className="rounded-md border border-n4 bg-white px-3 py-2 text-sm text-n1">
          Demo mode — sample interest requests. Try accepting one to see the reveal confirmation.
        </p>
      )}
      {requests.map((r) => {
        const status = statuses[r.id];
        return (
          <div key={r.id} className="rounded-lg border border-n4 bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-xl">{r.company}</div>
                <div className="text-sm text-n1">
                  {r.role} · {BAND_LABEL[r.band]} · {r.city}
                </div>
              </div>
              <span className="text-xs text-n2">{r.sent}</span>
            </div>
            <p className="my-3 rounded-md bg-paper p-3 text-[15px] text-ink">“{r.note}”</p>

            {status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => setConfirming(r)} className="rounded-md bg-sage px-4 py-2 text-sm font-semibold text-white">
                  Accept & reveal
                </button>
                <button onClick={() => set(r.id, "declined")} className="rounded-md border border-n3 px-4 py-2 text-sm font-semibold">
                  Decline
                </button>
              </div>
            )}
            {status === "accepted" && (
              <div className="rounded-md bg-sage-soft px-3 py-2 text-sm font-semibold text-sage">
                Revealed to {r.company}. They now have your name, resume, and contact — and we&apos;ve introduced you over email.
              </div>
            )}
            {status === "declined" && <div className="text-sm text-n2">Declined — they were never shown who you are.</div>}
          </div>
        );
      })}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-[460px] rounded-lg border border-n4 bg-white p-6 shadow-[var(--shadow-soft)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-2xl">Share your full profile with {confirming.company}?</h3>
            <p className="text-[15px] text-n1">
              They&apos;ll see your name, resume, and contact details for the role{" "}
              <strong className="text-ink">{confirming.role} · {BAND_LABEL[confirming.band]} · {confirming.city}</strong>.
            </p>
            <div className="my-4 rounded-md border-l-[3px] border-clay bg-clay-soft p-3 text-sm">
              A reveal can&apos;t be undone. You can delete your data from OpenBench anytime, but
              anything you&apos;ve already shared by accepting is held by that company under their
              own policy.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { set(confirming.id, "accepted"); setConfirming(null); }}
                className="rounded-md bg-clay px-5 py-2.5 text-[15px] font-semibold text-white"
              >
                Yes, reveal to {confirming.company}
              </button>
              <button onClick={() => setConfirming(null)} className="rounded-md border border-n3 px-4 py-2.5 text-[15px] font-semibold">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
