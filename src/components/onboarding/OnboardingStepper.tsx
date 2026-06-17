"use client";

import { useState, useTransition } from "react";
import { EmployerConfirmation, type EmployerRow } from "./EmployerConfirmation";
import { DEMO_PARSED_EMPLOYERS } from "@/lib/demo";
import { CTC_BANDS, BAND_LABEL, type CtcBand } from "@/lib/bands";
import { uploadResume, runParse, savePreferences, setVisibility, publishProfile } from "@/lib/candidate/actions";

const STEPS = ["Upload", "Employers", "Preferences", "Visibility", "Publish"] as const;

const FUNCTIONS = ["Product", "Engineering", "Design", "Data", "Marketing", "Sales", "Operations"];
const INDUSTRIES = ["Fintech", "SaaS", "E-commerce", "Healthtech", "Edtech", "Gaming", "Consumer"];
const CITIES = ["Mumbai", "Bengaluru", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Remote"];
const SENIORITY = ["junior", "mid", "senior", "lead", "director", "vp_plus"];
const AVAILABILITY = [
  { v: "available_now", label: "Available now" },
  { v: "serving_notice", label: "Serving notice" },
  { v: "from_date", label: "From a future date" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-sage bg-sage text-white" : "border-n3 bg-paper text-ink hover:border-n2"
      }`}
    >
      {children}
    </button>
  );
}

function toggle<T>(arr: T[], v: T, max?: number): T[] {
  if (arr.includes(v)) return arr.filter((x) => x !== v);
  if (max && arr.length >= max) return arr;
  return [...arr, v];
}

export function OnboardingStepper({ demo }: { demo: boolean }) {
  const [step, setStep] = useState(0);
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  // preferences
  const [functions, setFunctions] = useState<string[]>(demo ? ["Product"] : []);
  const [industries, setIndustries] = useState<string[]>(demo ? ["Fintech", "SaaS"] : []);
  const [cities, setCities] = useState<string[]>(demo ? ["Mumbai"] : []);
  const [band, setBand] = useState<CtcBand | "">(demo ? "b25_40" : "");
  const [availability, setAvailability] = useState(demo ? "serving_notice" : "");
  const [seniority, setSeniority] = useState(demo ? "senior" : "");

  // visibility
  const [revealMode, setRevealMode] = useState<"none" | "past_only" | "all">("none");
  const [revealed, setRevealed] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  // real upload → parse (signed-in mode)
  const [file, setFile] = useState<File | null>(null);
  const [realEmployers, setRealEmployers] = useState<EmployerRow[]>([]);
  const [uploadBusy, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleUpload() {
    if (!file) {
      setUploadError("Choose a resume file first.");
      return;
    }
    setUploadError(null);
    startUpload(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadResume(fd);
      if (!up.ok) {
        setUploadError(up.error);
        return;
      }
      const parsed = await runParse(up.data!.resumeId);
      if (!parsed.ok) {
        setUploadError(parsed.error);
        return;
      }
      setRealEmployers(parsed.data!.employers);
      next();
    });
  }

  // Steps 2-4 persist to the server in real mode (no-op advance in demo).
  const [actionBusy, startAction] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function savePrefsAndContinue() {
    if (demo) return next();
    setActionError(null);
    startAction(async () => {
      const res = await savePreferences({
        functions, industries, cities,
        remote_only: cities.includes("Remote"),
        work_mode_pref: null,
        expected_band: band || null,
        current_band: null,
        availability: availability || null,
        availability_date: null,
        seniority: seniority || null,
      });
      if (!res.ok) setActionError(res.error);
      else next();
    });
  }

  function saveVisibilityAndContinue() {
    if (demo) return next();
    setActionError(null);
    startAction(async () => {
      const res = await setVisibility({ reveal_employers_mode: revealMode, revealedEmployerIds: revealed });
      if (!res.ok) setActionError(res.error);
      else next();
    });
  }

  function doPublish() {
    if (demo) return setPublished(true);
    setActionError(null);
    startAction(async () => {
      const res = await publishProfile();
      if (!res.ok) return setActionError(res.error);
      if (res.data && res.data.blockers.length) {
        return setActionError("Not ready yet — finish: " + res.data.blockers.join(", ").replace(/_/g, " "));
      }
      setPublished(true);
    });
  }

  return (
    <div className="mx-auto max-w-[680px]">
      {/* progress */}
      <ol className="mb-10 flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i < step ? "bg-sage text-white" : i === step ? "bg-ink text-white" : "bg-n4 text-n1"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i === step ? "font-semibold" : "text-n2"}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-n4" />}
          </li>
        ))}
      </ol>

      {demo && (
        <p className="mb-6 rounded-md border border-n4 bg-white px-3 py-2 text-sm text-n1">
          Demo mode — no database connected. Click through the flow; nothing is saved.
        </p>
      )}

      {step === 0 && (
        <section>
          <h2 className="mb-2 text-3xl">Upload your resume</h2>
          <p className="mb-5 text-n1">PDF, DOCX, or TXT, up to 10 MB. We read it once to pre-fill your profile — it&apos;s never shown to anyone until you accept a reveal.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-n3 bg-white px-6 py-12 text-center">
            <span className="font-medium">{file ? file.name : "Drop your resume here, or click to choose"}</span>
            <span className="mt-1 text-sm text-n2">We&apos;ll extract your employers and skills</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {uploadError && <p className="mt-3 text-sm text-error">{uploadError}</p>}
          <div className="mt-6">
            <button
              onClick={demo ? next : handleUpload}
              disabled={uploadBusy}
              className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {demo ? "Continue with sample resume" : uploadBusy ? "Reading your resume…" : "Upload & parse"}
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <EmployerConfirmation
          parsedEmployers={demo ? DEMO_PARSED_EMPLOYERS : realEmployers}
          demo={demo}
          embedded
          onConfirmed={(emps) => {
            setRealEmployers(emps);
            next();
          }}
        />
      )}

      {step === 2 && (
        <section>
          <h2 className="mb-2 text-3xl">What are you looking for?</h2>
          <p className="mb-6 text-n1">Employers see these as your declared terms. Your current salary stays private.</p>

          <Field label="Target functions (up to 3)">
            <div className="flex flex-wrap gap-2">
              {FUNCTIONS.map((f) => (
                <Chip key={f} active={functions.includes(f)} onClick={() => setFunctions((a) => toggle(a, f, 3))}>{f}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Industries (up to 5)">
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((f) => (
                <Chip key={f} active={industries.includes(f)} onClick={() => setIndustries((a) => toggle(a, f, 5))}>{f}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Cities">
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <Chip key={c} active={cities.includes(c)} onClick={() => setCities((a) => toggle(a, c))}>{c}</Chip>
              ))}
            </div>
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Expected band">
              <select value={band} onChange={(e) => setBand(e.target.value as CtcBand)} className="w-full rounded-md border border-n3 bg-paper px-3 py-2">
                <option value="">Select…</option>
                {CTC_BANDS.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
              </select>
            </Field>
            <Field label="Availability">
              <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full rounded-md border border-n3 bg-paper px-3 py-2">
                <option value="">Select…</option>
                {AVAILABILITY.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Seniority">
              <select value={seniority} onChange={(e) => setSeniority(e.target.value)} className="w-full rounded-md border border-n3 bg-paper px-3 py-2 capitalize">
                <option value="">Select…</option>
                {SENIORITY.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
          </div>
          {actionError && <p className="mt-4 text-sm text-error">{actionError}</p>}
          <Nav back={back} onNext={savePrefsAndContinue} busy={actionBusy} />
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="mb-2 text-3xl">How visible do you want to be?</h2>
          <p className="mb-6 text-n1">Your name and contact are always hidden until you accept a reveal. This controls only whether employers can see <em>which companies</em> you&apos;ve worked at.</p>

          <div className="space-y-3">
            {[
              { v: "none", t: "Keep all employers hidden", d: "Recommended. Employers see your skills, band, and availability — never your company names — until you reveal." },
              { v: "past_only", t: "Show past employers only", d: "Your current employer stays hidden; you can opt-in specific past ones below." },
              { v: "all", t: "Show employers I opt in", d: "Pick exactly which companies are visible below." },
            ].map((o) => (
              <label key={o.v} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${revealMode === o.v ? "border-sage bg-sage-soft" : "border-n4 bg-white"}`}>
                <input type="radio" name="reveal" className="mt-1" checked={revealMode === o.v} onChange={() => setRevealMode(o.v as typeof revealMode)} />
                <span>
                  <span className="block font-semibold">{o.t}</span>
                  <span className="text-sm text-n1">{o.d}</span>
                </span>
              </label>
            ))}
          </div>

          {revealMode !== "none" && (
            <div className="mt-5 rounded-lg border border-n4 bg-white p-4">
              <p className="mb-3 text-sm font-semibold">Which employers can be shown?</p>
              <div className="space-y-2">
                {realEmployers.filter((e) => revealMode === "all" || !e.is_current).map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-[15px]">
                    <input type="checkbox" checked={revealed.includes(e.id)} onChange={() => setRevealed((a) => toggle(a, e.id))} />
                    {e.name}
                    {e.tenure && <span className="text-sm text-n2">· {e.tenure}</span>}
                    {e.is_current && <span className="rounded-full bg-clay-soft px-2 py-0.5 text-xs font-semibold text-clay">current</span>}
                  </label>
                ))}
                {realEmployers.filter((e) => revealMode === "all" || !e.is_current).length === 0 && (
                  <p className="text-sm text-n2">No employers to show under this option.</p>
                )}
                {revealMode === "past_only" && (
                  <p className="text-xs text-n2">Your current employer can never be shown under this option.</p>
                )}
              </div>
            </div>
          )}
          {actionError && <p className="mt-4 text-sm text-error">{actionError}</p>}
          <Nav back={back} onNext={saveVisibilityAndContinue} busy={actionBusy} />
        </section>
      )}

      {step === 4 && !published && (
        <section>
          <h2 className="mb-2 text-3xl">Ready to publish</h2>
          <p className="mb-6 text-n1">Once published, verified employers can find you by your terms — still anonymous until you accept.</p>
          <ul className="mb-6 divide-y divide-n4 rounded-lg border border-n4 bg-white">
            {[
              ["Resume uploaded", true],
              ["Employer list confirmed (blocklist set)", true],
              [`Preferences set (${functions.join(", ") || "—"}, ${band ? BAND_LABEL[band as CtcBand] : "—"})`, functions.length > 0 && !!band],
              [`Visibility chosen (${revealMode.replace("_", " ")})`, true],
            ].map(([label, ok], i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${ok ? "bg-success" : "bg-n3"}`}>{ok ? "✓" : "!"}</span>
                {label}
              </li>
            ))}
          </ul>
          {actionError && <p className="mb-4 text-sm text-error">{actionError}</p>}
          <div className="flex items-center gap-3">
            <button onClick={back} className="rounded-md border border-n3 px-4 py-2.5 text-[15px] font-semibold">Back</button>
            <button onClick={doPublish} disabled={actionBusy} className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40">
              {actionBusy ? "Publishing…" : "Publish my profile"}
            </button>
          </div>
        </section>
      )}

      {step === 4 && published && (
        <section className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sage-soft text-2xl text-sage">✓</div>
          <h2 className="mb-2 text-3xl">You&apos;re live — and invisible</h2>
          <p className="mx-auto max-w-[440px] text-n1">
            Employers can now find you by your declared terms. Your name and employers stay
            hidden until you accept a reveal. We&apos;ll email you the moment someone&apos;s interested.
          </p>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Nav({ back, onNext, busy = false }: { back: () => void; onNext: () => void; busy?: boolean }) {
  return (
    <div className="mt-7 flex items-center gap-3">
      <button onClick={back} className="rounded-md border border-n3 px-4 py-2.5 text-[15px] font-semibold">Back</button>
      <button onClick={onNext} disabled={busy} className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40">
        {busy ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
