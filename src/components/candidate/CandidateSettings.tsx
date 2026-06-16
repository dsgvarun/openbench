"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCandidateStatus, deleteAccount } from "@/lib/candidate/actions";

type Status = "active" | "paused" | "placed";

// Candidate account controls: pause/resume/placed + DPDP account deletion.
export function CandidateSettings({ initialStatus }: { initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: Status) {
    setError(null);
    startTransition(async () => {
      const res = await setCandidateStatus(next);
      if (res.ok) setStatus(next);
      else setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount();
      if (res.ok) router.push("/");
      else setError(res.error);
    });
  }

  const labels: Record<Status, string> = {
    active: "Active — visible to verified employers",
    paused: "Paused — hidden from search, nothing deleted",
    placed: "Placed — hidden, you found a role 🎉",
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-2xl">Your visibility</h2>
        <p className="mb-4 text-n1">Current: <strong>{labels[status]}</strong></p>
        <div className="flex flex-wrap gap-2">
          {(["active", "paused", "placed"] as Status[]).map((s) => (
            <button
              key={s}
              disabled={pending || s === status}
              onClick={() => change(s)}
              className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                s === status ? "bg-sage text-white" : "border border-n3"
              }`}
            >
              {s === "active" ? "Set active" : s === "paused" ? "Pause" : "Mark placed"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-clay/40 bg-clay-soft/40 p-5">
        <h2 className="mb-1 text-2xl">Delete your account</h2>
        <p className="mb-4 text-sm text-n1">
          Removes your resume, profile, and preferences from OpenBench and revokes future
          access. Anything you&apos;ve already shared by accepting a reveal stays with that
          company under their own policy. This can&apos;t be undone.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="rounded-md border border-clay px-4 py-2 text-sm font-semibold text-clay">
            Delete my account
          </button>
        ) : (
          <div className="flex gap-2">
            <button disabled={pending} onClick={remove} className="rounded-md bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {pending ? "Deleting…" : "Yes, permanently delete"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-n3 px-4 py-2 text-sm font-semibold">Cancel</button>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
