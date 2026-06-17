"use server";

import { createClient } from "@/lib/supabase/server";

// Employer verification (Phase 3.1). A company self-registers (pending); a platform
// admin approves. Work email must match the company domain; free-mail is rejected.

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
  "live.com", "icloud.com", "proton.me", "protonmail.com", "rediffmail.com", "aol.com", "zoho.com",
]);

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function domainOf(email: string): string | null {
  const m = email.trim().toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : null;
}

export async function registerCompany(input: {
  legalName: string;
  domain: string;
  workEmail: string;
  role?: string;
}): Promise<Result<{ companyId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in with your work email first." };

  const domain = input.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const emailDomain = domainOf(input.workEmail);

  if (!domain) return { ok: false, error: "Enter your company domain." };
  if (FREE_MAIL.has(domain)) return { ok: false, error: "Use a company domain, not a free email provider." };
  if (!emailDomain) return { ok: false, error: "Enter a valid work email." };
  if (emailDomain !== domain) return { ok: false, error: `Your work email must be @${domain}.` };
  if (FREE_MAIL.has(emailDomain)) return { ok: false, error: "Use your work email, not a free email provider." };

  // Create company (pending) + seat atomically via SECURITY DEFINER RPC.
  const { data, error } = await supabase.rpc("register_company", {
    p_legal_name: input.legalName.trim(),
    p_domain: domain,
    p_work_email: input.workEmail.trim().toLowerCase(),
    p_role: input.role ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; error?: string; company_id?: string };
  if (!res.ok) {
    const msg: Record<string, string> = {
      not_signed_in: "Sign in first.",
      already_registered: "You're already linked to a company.",
      domain_exists: "A company with this domain is already registered. Ask a colleague to add you.",
    };
    return { ok: false, error: msg[res.error ?? ""] ?? "Could not register the company." };
  }
  return { ok: true, data: { companyId: res.company_id! } };
}

// Admin-only (RLS company_admin_update gates this to app_admin members).
export async function setCompanyVerification(companyId: string, status: "approved" | "rejected"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("company").update({ verification_status: status }).eq("id", companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
