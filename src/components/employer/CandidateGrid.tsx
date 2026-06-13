"use client";

import { useMemo, useState } from "react";
import { BAND_LABEL, CTC_BANDS, type CtcBand } from "@/lib/bands";
import type { DemoCard } from "@/lib/demo";

// Employer search results: hidden-by-default candidate cards + send-interest flow.
// In demo mode the send is a local confirmation; with a DB it calls sendInterest().
export function CandidateGrid({ cards, demo }: { cards: DemoCard[]; demo: boolean }) {
  const [fn, setFn] = useState("");
  const [band, setBand] = useState("");
  const [city, setCity] = useState("");
  const [target, setTarget] = useState<DemoCard | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!fn || c.headline.toLowerCase().includes(fn.toLowerCase()) || c.industries.join(" ").toLowerCase().includes(fn.toLowerCase())) &&
          (!band || c.expected_band === band) &&
          (!city || c.cities.some((ci) => ci.toLowerCase().includes(city.toLowerCase()))),
      ),
    [cards, fn, band, city],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Skill, function, or industry" className="min-w-[220px] flex-1 rounded-md border border-n3 bg-white px-3 py-2 text-[15px]" />
        <select value={band} onChange={(e) => setBand(e.target.value)} className="rounded-md border border-n3 bg-white px-3 py-2 text-[15px]">
          <option value="">Any band</option>
          {CTC_BANDS.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
        </select>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-40 rounded-md border border-n3 bg-white px-3 py-2 text-[15px]" />
      </div>

      <p className="mb-4 text-sm text-n1">
        {filtered.length} candidate{filtered.length === 1 ? "" : "s"} match · all anonymous until they accept
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((c) => {
          const sent = sentTo.includes(c.candidate_id);
          return (
            <div key={c.candidate_id} className="rounded-md border border-n4 bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-soft font-bold text-clay">
                  {c.headline.match(/\b\w/g)?.slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div className="font-display text-lg">
                    {c.headline} <span className="font-sans text-sm font-normal text-n2">· hidden</span>
                  </div>
                  <div className="text-sm text-n1">
                    {c.cities.join(", ")} · {c.seniority} · {c.availability}
                  </div>
                </div>
              </div>
              <div className="my-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-sage">{BAND_LABEL[c.expected_band]} expected</span>
                {c.industries.map((i) => (
                  <span key={i} className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-sage">{i}</span>
                ))}
                {c.employers_hidden && (
                  <span className="rounded-full bg-clay-soft px-2.5 py-1 text-xs font-semibold text-clay">Employers hidden by candidate</span>
                )}
              </div>
              <div className="mb-4 text-sm text-n1">{c.skills.join(" · ")}</div>
              <div className="flex gap-2">
                <button
                  disabled={sent}
                  onClick={() => setTarget(c)}
                  className="rounded-md bg-sage px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {sent ? "Interest sent" : "Send interest"}
                </button>
                <button className="rounded-md border border-n3 px-4 py-2 text-sm font-semibold">Save</button>
              </div>
            </div>
          );
        })}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setTarget(null)}>
          <div className="w-full max-w-[460px] rounded-lg border border-n4 bg-white p-6 shadow-[var(--shadow-soft)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-2xl">Send interest</h3>
            <p className="mb-4 text-sm text-n1">Attach one of your open roles and a short note. They&apos;ll see your company and the role — and decide whether to reveal.</p>
            <label className="mb-1 block text-sm font-semibold">Attach a role</label>
            <select className="mb-3 w-full rounded-md border border-n3 bg-paper px-3 py-2 text-[15px]">
              <option>Senior PM, Payments · ₹25–40L · Mumbai</option>
              <option>Group PM, Platform · ₹40–60L · Remote</option>
            </select>
            <label className="mb-1 block text-sm font-semibold">Note (max 300 chars)</label>
            <textarea maxLength={300} rows={3} className="mb-4 w-full rounded-md border border-n3 bg-paper px-3 py-2 text-[15px]" placeholder="Why this role fits them…" />
            <div className="flex gap-2">
              <button
                onClick={() => { setSentTo((a) => [...a, target.candidate_id]); setTarget(null); }}
                className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white"
              >
                {demo ? "Send (demo)" : "Send interest"}
              </button>
              <button onClick={() => setTarget(null)} className="rounded-md border border-n3 px-4 py-2.5 text-[15px] font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
