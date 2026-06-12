"use client";

import { useState, useTransition } from "react";
import { confirmEmployers } from "@/lib/candidate/actions";

export interface EmployerRow {
  id: string;
  name: string;
  domain: string | null;
  is_current: boolean;
}

// The fail-closed safety step (Phase 2.3 / design review): the candidate must SEE the
// employer list and explicitly confirm it before publishing. A missed employer = the
// at-risk candidate's employer can find them, so this screen carries real visual weight.
export function EmployerConfirmation({
  parsedEmployers,
  onConfirmed,
}: {
  parsedEmployers: EmployerRow[];
  onConfirmed?: () => void;
}) {
  const [added, setAdded] = useState<{ name: string; domain: string; is_current: boolean }[]>([]);
  const [draft, setDraft] = useState({ name: "", domain: "", is_current: false });
  const [attested, setAttested] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = parsedEmployers.length + added.length;

  function addEmployer() {
    if (!draft.name.trim()) return;
    setAdded((a) => [...a, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: "", domain: "", is_current: false });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await confirmEmployers({ addedEmployers: added });
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        onConfirmed?.();
      }
    });
  }

  if (done) {
    return (
      <section className="mx-auto max-w-[640px]">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">Saved</span>
        <h2 className="mb-2 mt-3 text-3xl">Your blocklist is set</h2>
        <p className="text-n1">
          Those companies will never see your profile. Next: set your preferences and choose
          how visible you want to be.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[640px]">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-clay">Safety check</span>
      <h2 className="mb-2 mt-3 text-3xl">Confirm who we&apos;ll hide you from</h2>
      <p className="mb-5 text-n1">
        These are the companies that will never see your profile — not in search, not in
        counts, not even by a direct link. If we missed any employer, add them now. This is
        the one step we can&apos;t let you skip.
      </p>

      <ul className="mb-4 divide-y divide-n4 rounded-lg border border-n4 bg-white">
        {total === 0 && (
          <li className="px-4 py-5 text-n1">
            We couldn&apos;t read any employers automatically. Add every company you&apos;ve
            worked at below — especially your current one.
          </li>
        )}
        {parsedEmployers.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">
              {e.name}
              {e.is_current && (
                <span className="ml-2 rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-semibold text-clay">
                  current
                </span>
              )}
            </span>
            {e.domain && <span className="text-sm text-n2">{e.domain}</span>}
          </li>
        ))}
        {added.map((e, i) => (
          <li key={`added-${i}`} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">
              {e.name}
              {e.is_current && (
                <span className="ml-2 rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-semibold text-clay">
                  current
                </span>
              )}
              <span className="ml-2 text-xs text-n2">added by you</span>
            </span>
            {e.domain && <span className="text-sm text-n2">{e.domain}</span>}
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
          <input
            type="checkbox"
            checked={draft.is_current}
            onChange={(e) => setDraft({ ...draft, is_current: e.target.checked })}
          />
          This is my current employer
        </label>
        <button
          type="button"
          onClick={addEmployer}
          className="mt-3 rounded-md border border-n3 px-4 py-2 text-sm font-semibold"
        >
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
