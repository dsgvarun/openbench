"use client";

import { useState, useTransition } from "react";
import { createListing, closeListing } from "@/lib/employer/listing-actions";
import { BAND_LABEL, CTC_BANDS, type CtcBand } from "@/lib/bands";

export interface Listing {
  id: string;
  title: string;
  function: string;
  city: string | null;
  ctc_band: CtcBand;
  status: string;
}

const FUNCTIONS = ["Product", "Engineering", "Design", "Data", "Marketing", "Sales", "Operations"];
const WORK_MODES = ["onsite", "hybrid", "remote"];
const SENIORITY = ["junior", "mid", "senior", "lead", "director", "vp_plus"];

export function ListingManager({ initial }: { initial: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", function: "Product", city: "", remote: false,
    work_mode: "hybrid", ctc_band: "b25_40" as CtcBand, seniority: "senior", jd_url: "",
  });

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createListing(form);
      if (!res.ok) { setError(res.error); return; }
      setListings((l) => [
        { id: res.data!.id, title: form.title, function: form.function, city: form.city || null, ctc_band: form.ctc_band, status: "open" },
        ...l,
      ]);
      setForm({ ...form, title: "", city: "", jd_url: "" });
      setOpen(false);
    });
  }

  function close(id: string) {
    startTransition(async () => {
      await closeListing(id);
      setListings((l) => l.map((x) => (x.id === id ? { ...x, status: "closed" } : x)));
    });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl">Your roles</h2>
        <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-n3 px-4 py-2 text-sm font-semibold">
          {open ? "Cancel" : "+ New role"}
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border border-n4 bg-white p-5">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Role title (e.g. Senior PM, Payments)" className="inp" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={form.function} onChange={(e) => setForm({ ...form, function: e.target.value })} className="inp">
              {FUNCTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <select value={form.ctc_band} onChange={(e) => setForm({ ...form, ctc_band: e.target.value as CtcBand })} className="inp">
              {CTC_BANDS.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
            </select>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="inp" />
            <select value={form.work_mode} onChange={(e) => setForm({ ...form, work_mode: e.target.value })} className="inp">
              {WORK_MODES.map((w) => <option key={w}>{w}</option>)}
            </select>
            <select value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} className="inp capitalize">
              {SENIORITY.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <input value={form.jd_url} onChange={(e) => setForm({ ...form, jd_url: e.target.value })} placeholder="JD link (optional)" className="inp" />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button type="submit" disabled={pending} className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40">
            {pending ? "Creating…" : "Post role"}
          </button>
          <style>{`.inp{width:100%;border:1px solid var(--color-n3);background:var(--color-paper);border-radius:var(--radius-md);padding:9px 12px;font-size:15px}`}</style>
        </form>
      )}

      {listings.length === 0 ? (
        <p className="rounded-lg border border-n4 bg-white p-6 text-n1">No roles yet. Post one so you can send interest to candidates.</p>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-n4 bg-white p-4">
              <div>
                <div className="font-medium">
                  {l.title}{" "}
                  {l.status !== "open" && <span className="ml-1 rounded-full bg-n4 px-2 py-0.5 text-xs text-n1">{l.status}</span>}
                </div>
                <div className="text-sm text-n1">{l.function} · {l.city || "—"} · {BAND_LABEL[l.ctc_band]}</div>
              </div>
              {l.status === "open" && (
                <button onClick={() => close(l.id)} disabled={pending} className="text-sm font-semibold text-n1">Close</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
