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

  // Company starts pending; an admin approves before the index unlocks.
  const { data: company, error: cErr } = await supabase
    .from("company")
    .insert({ legal_name: input.legalName.trim(), domain, verification_status: "pending" })
    .select("id")
    .single();
  if (cErr || !company) return { ok: false, error: cErr?.message ?? "Could not create the company." };

  const { error: sErr } = await supabase
    .from("seat")
    .insert({ company_id: company.id, user_id: user.id, email: input.workEmail.trim().toLowerCase(), role: input.role });
  if (sErr) return { ok: false, error: sErr.message };

  return { ok: true, data: { companyId: company.id as string } };
}

// Admin-only (RLS company_admin_update gates this to app_admin members).
export async function setCompanyVerification(companyId: string, status: "approved" | "rejected"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("company").update({ verification_status: status }).eq("id", companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
