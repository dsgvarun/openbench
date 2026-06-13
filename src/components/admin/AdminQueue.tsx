"use client";

import { useState } from "react";
import { setCompanyVerification } from "@/lib/employer/actions";
import type { DemoCompany } from "@/lib/demo";

// Admin company verification queue (Phase 3.1). Approve/reject pending companies.
// Demo mode resolves locally; with a DB it calls setCompanyVerification (RLS-gated to admins).
export function AdminQueue({ companies, demo }: { companies: DemoCompany[]; demo: boolean }) {
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    if (!demo) {
      setBusy(id);
      await setCompanyVerification(id, status);
      setBusy(null);
    }
    setDecided((m) => ({ ...m, [id]: status }));
  }

  const pending = companies.filter((c) => !decided[c.id]);

  return (
    <div>
      {demo && (
        <p className="mb-6 rounded-md border border-n4 bg-white px-3 py-2 text-sm text-n1">
          Demo mode — sample verification queue. Approving/rejecting resolves locally.
        </p>
      )}
      {pending.length === 0 ? (
        <div className="rounded-lg border border-n4 bg-white p-8 text-center text-n1">
          Queue clear — no companies waiting on verification.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-n4 bg-white p-5 shadow-[var(--shadow-soft)]">
              <div>
                <div className="font-display text-lg">{c.legal_name}</div>
                <div className="text-sm text-n1">
                  {c.domain} · requested by {c.seat_email} · {c.requested}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy === c.id}
                  onClick={() => decide(c.id, "approved")}
                  className="rounded-md bg-sage px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  disabled={busy === c.id}
                  onClick={() => decide(c.id, "rejected")}
                  className="rounded-md border border-n3 px-4 py-2 text-sm font-semibold"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {Object.entries(decided).length > 0 && (
        <div className="mt-6 space-y-1 text-sm text-n2">
          {Object.entries(decided).map(([id, s]) => {
            const c = companies.find((x) => x.id === id)!;
            return (
              <div key={id}>
                {s === "approved" ? "✓ Approved" : "✗ Rejected"} {c.legal_name}
                {s === "approved" && " — the index is now unlocked for their seats."}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
