"use server";

import { createClient } from "@/lib/supabase/server";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export interface MyCompany {
  companyId: string;
  legalName: string;
  status: "pending" | "approved" | "rejected";
}

// The signed-in user's company (via their seat), if any.
export async function getMyCompany(): Promise<MyCompany | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: seat } = await supabase
    .from("seat")
    .select("company:company_id(id, legal_name, verification_status)")
    .eq("user_id", user.id)
    .maybeSingle();
  // Supabase types a to-one embed as an array; at runtime it's a single object.
  const raw = seat?.company as unknown;
  const company = (Array.isArray(raw) ? raw[0] : raw) as
    | { id: string; legal_name: string; verification_status: MyCompany["status"] }
    | null
    | undefined;
  if (!company) return null;
  return { companyId: company.id, legalName: company.legal_name, status: company.verification_status };
}

export interface NewListing {
  title: string;
  function: string;
  city: string;
  remote: boolean;
  work_mode: string | null;
  ctc_band: string;
  seniority: string | null;
  jd_url: string;
}

// Create a job listing. RLS (listing_company_write) only permits this for an APPROVED
// seat, so a pending/unverified company gets a clear error.
export async function createListing(input: NewListing): Promise<Result<{ id: string }>> {
  const company = await getMyCompany();
  if (!company) return { ok: false, error: "Register your company first." };
  if (company.status !== "approved") return { ok: false, error: "Your company is awaiting verification." };
  if (!input.title.trim() || !input.function.trim() || !input.ctc_band) {
    return { ok: false, error: "Title, function, and comp band are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_listing")
    .insert({
      company_id: company.companyId,
      title: input.title.trim(),
      function: input.function.trim(),
      city: input.city.trim() || null,
      remote: input.remote,
      work_mode: input.work_mode,
      ctc_band: input.ctc_band,
      seniority: input.seniority,
      jd_url: input.jd_url.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the listing." };
  return { ok: true, data: { id: data.id as string } };
}

export async function closeListing(listingId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_listing").update({ status: "closed" }).eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
