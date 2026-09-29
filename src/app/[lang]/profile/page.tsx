import { redirect } from "next/navigation";
import { CustomerProfile } from "@/components/customer/CustomerProfile";
import { createClient } from "@/lib/supabase/server";
import { isSupportedLocale } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) redirect("/ro/login");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/${lang}/login?next=profile`);
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) redirect(`/${lang}/login?reason=security`);
  const [customerRequirement, platformAccess] = await Promise.all([
    client.schema("customer_api").rpc("my_mfa_requirement_v1"),
    client.schema("customer_api").rpc("has_platform_access_v1"),
  ]);
  if (customerRequirement.error || platformAccess.error) redirect(`/${lang}/login?reason=security`);
  const verified = factors.totp.some((factor) => factor.status === "verified");
  if ((customerRequirement.data || platformAccess.data) && !verified) redirect(`/${lang}/mfa/setup?reason=${platformAccess.data ? "platform_required" : "customer_required"}`);
  if (verified) {
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") redirect(`/${lang}/mfa`);
  }
  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8"><CustomerProfile lang={lang} /></main>;
}
