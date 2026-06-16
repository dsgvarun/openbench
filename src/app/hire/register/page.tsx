import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompany } from "@/lib/employer/listing-actions";
import { CompanyRegisterForm } from "@/components/employer/CompanyRegisterForm";

// Employer company registration. Requires sign-in; if a company already exists for this
// user, bounce to /hire.
export default async function Register() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/hire/register");

  const company = await getMyCompany();
  if (company) redirect("/hire");

  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
      </header>
      <div className="mx-auto max-w-[460px] py-14">
        <h1 className="mb-2 text-3xl">Register your company</h1>
        <p className="mb-6 text-n1">Once verified, you&apos;ll see the live comp index and can reach candidates.</p>
        <CompanyRegisterForm defaultEmail={user.email ?? undefined} />
      </div>
    </main>
  );
}
