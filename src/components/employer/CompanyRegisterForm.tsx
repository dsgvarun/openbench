"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerCompany } from "@/lib/employer/actions";

// Employer self-registration. Work email must match the company domain; free-mail rejected
// (validated server-side in registerCompany). Company starts pending until an admin approves.
export function CompanyRegisterForm({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [domain, setDomain] = useState("");
  const [workEmail, setWorkEmail] = useState(defaultEmail ?? "");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registerCompany({ legalName, domain, workEmail, role });
      if (!res.ok) setError(res.error);
      else router.push("/hire");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Company legal name">
        <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className="input" placeholder="Acme Fintech Pvt Ltd" />
      </Field>
      <Field label="Company domain">
        <input required value={domain} onChange={(e) => setDomain(e.target.value)} className="input" placeholder="acmefintech.com" />
      </Field>
      <Field label="Your work email (must be @ your domain)">
        <input required type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="input" placeholder="you@acmefintech.com" />
      </Field>
      <Field label="Your role (optional)">
        <input value={role} onChange={(e) => setRole(e.target.value)} className="input" placeholder="Head of Talent" />
      </Field>
      {error && <p className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40">
        {pending ? "Submitting…" : "Submit for verification"}
      </button>
      <p className="text-sm text-n2">We verify direct employers within 24 hours. No free-mail domains.</p>
      <style>{`.input{width:100%;border:1px solid var(--color-n3);background:#fff;border-radius:var(--radius-md);padding:10px 14px;font-size:15px}`}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}
