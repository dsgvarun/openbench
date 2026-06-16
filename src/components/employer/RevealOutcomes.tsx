"use client";

import { useState, useTransition } from "react";
import { setRevealOutcome } from "@/lib/reveal/actions";

export interface RevealedCandidate {
  revealId: string;
  name: string;
  email: string | null;
  headline: string;
  outcome: "in_process" | "hired" | "passed" | null;
}

const OUTCOMES: { v: "in_process" | "hired" | "passed"; label: string }[] = [
  { v: "in_process", label: "In process" },
  { v: "hired", label: "Hired" },
  { v: "passed", label: "Passed" },
];

// Revealed candidates (full contact) + outcome marking. Outcomes feed placement metrics.
export function RevealOutcomes({ reveals }: { reveals: RevealedCandidate[] }) {
  const [state, setState] = useState<Record<string, RevealedCandidate["outcome"]>>(
    Object.fromEntries(reveals.map((r) => [r.revealId, r.outcome])),
  );
  const [pending, startTransition] = useTransition();

  function mark(id: string, outcome: "in_process" | "hired" | "passed") {
    startTransition(async () => {
      const res = await setRevealOutcome(id, outcome);
      if (res.ok) setState((s) => ({ ...s, [id]: outcome }));
    });
  }

  if (reveals.length === 0)
    return <p className="rounded-lg border border-n4 bg-white p-6 text-n1">No reveals yet. When a candidate accepts your interest, they appear here with full contact.</p>;

  return (
    <div className="space-y-3">
      {reveals.map((r) => (
        <div key={r.revealId} className="rounded-lg border border-n4 bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-lg">{r.name}</div>
              <div className="text-sm text-n1">{r.headline}</div>
              {r.email && <a href={`mailto:${r.email}`} className="text-sm font-semibold text-sage">{r.email}</a>}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.v}
                disabled={pending}
                onClick={() => mark(r.revealId, o.v)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                  state[r.revealId] === o.v ? "bg-sage text-white" : "border border-n3"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
