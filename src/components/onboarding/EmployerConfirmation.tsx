"use client";

import { useState, useTransition } from "react";
import { confirmEmployers } from "@/lib/candidate/actions";

export interface EmployerRow {
  id: string;
  name: string;
  domain: string | null;
  is_current: boolean;
  tenure: string | null;
}

// The fail-closed safety step (Phase 2.3 / design review): the candidate must SEE the
// employer list and explicitly confirm it before publishing. They can remove anything
// that isn't an employer (e.g. a school) and add anything we missed.
export function EmployerConfirmation({
  parsedEmployers,
  onConfirmed,
  demo = false,
  embedded = false,
}: {
  parsedEmployers: EmployerRow[];
  /** Receives the canonical confirmed list (with stable ids) for the visibility step. */
  onConfirmed?: (employers: EmployerRow[]) => void;
  demo?: boolean;
  embedded?: boolean;
}) {
  const [rows, setRows] = useState<EmployerRow[]>(parsedEmployers);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<{ name: string; domain: string; is_current: boolean }[]>([]);
  const [draft, setDraft] = useState({ name: "", domain: "", is_current: false });
  const [attested, setAttested] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = rows.length + added.length;

  function addEmployer() {
    if (!draft.name.trim()) return;
    setAdded((a) => [...a, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: "", domain: "", is_current: false });
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    setRemovedIds((ids) => [...ids, id]);
  }

  function submit() {
    setError(null);
    if (demo) {
      // Synthesize the confirmed list locally for the visibility step.
      const list: EmployerRow[] = [
        ...rows,
        ...added.map((a, i) => ({ id: `local-${i}`, name: a.name, domain: a.domain || null, is_current: a.is_current, tenure: null })),
      ];
      setDone(true);
      onConfirmed?.(list);
      return;
    }
    startTransition(async () => {
      const res = await confirmEmployers({ addedEmployers: added, removedIds });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      onConfirmed?.(res.data!.employers);
    });
  }

  if (done && !embedded) {
    return (
      <section className="mx-auto max-w-[640px]">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">Saved</span>
        <h2 className="mb-2 mt-3 text-3xl">Your blocklist is set</h2>
        <p className="text-n1">Those companies will never see your profile. Next: preferences and visibility.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[640px]">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">Safety check</span>
      <h2 className="mb-2 mt-3 text-3xl">Confirm who we&apos;ll hide you from</h2>
      <p className="mb-5 text-n1">
        These are the companies that will never see your profile — not in search, not in
        counts, not even by a direct link. Remove anything that isn&apos;t an employer, add
        any we missed. This is the one step we can&apos;t let you skip.
      </p>

      <ul className="mb-4 divide-y divide-n4 rounded-lg border border-n4 bg-white">
        {total === 0 && (
          <li className="px-4 py-5 text-n1">
            No employers yet. Add every company you&apos;ve worked at below — especially your
            current one.
          </li>
        )}
        {rows.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <span className="font-medium">{e.name}</span>
              {e.is_current && (
                <span className="ml-2 rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-semibold text-clay">current</span>
              )}
              <div className="text-sm text-n2">
                {[e.tenure, e.domain].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeRow(e.id)}
              aria-label={`Remove ${e.name}`}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-n2 hover:text-error"
            >
              Remove
            </button>
          </li>
        ))}
        {added.map((e, i) => (
          <li key={`added-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <span className="font-medium">{e.name}</span>
              {e.is_current && (
                <span className="ml-2 rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-semibold text-clay">current</span>
              )}
              <div className="text-sm text-n2">{[e.domain, "added by you"].filter(Boolean).join(" · ")}</div>
            </div>
            <button
              type="button"
              onClick={() => setAdded((a) => a.filter((_, j) => j !== i))}
              aria-label={`Remove ${e.name}`}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-n2 hover:text-error"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mb-6 rounded-lg border border-n4 bg-white p-4">
        <p className="mb-3 text-sm font-semibold">Add a company we missed</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-n3 bg-paper px-3 py-2 text-[15px]"
            placeholder="Company name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="flex-1 rounded-md border border-n3 bg-paper px-3 py-2 text-[15px]"
            placeholder="domain.com (optional)"
            value={draft.domain}
            onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-n1">
          <input type="checkbox" checked={draft.is_current} onChange={(e) => setDraft({ ...draft, is_current: e.target.checked })} />
          This is my current employer
        </label>
        <button type="button" onClick={addEmployer} className="mt-3 rounded-md border border-n3 px-4 py-2 text-sm font-semibold">
          Add company
        </button>
      </div>

      <label className="mb-4 flex items-start gap-3 rounded-lg border-l-[3px] border-clay bg-clay-soft p-4 text-[15px]">
        <input type="checkbox" className="mt-1" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        <span>
          I&apos;ve reviewed this list and it includes <strong>every</strong> company I&apos;ve
          worked at, including my current employer. I understand these companies will never
          see my profile.
        </span>
      </label>

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <button
        type="button"
        disabled={!attested || pending}
        onClick={submit}
        className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : "Confirm and continue"}
      </button>
    </section>
  );
}
