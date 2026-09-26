import { Building2, LockKeyhole } from "lucide-react";
import { OperationalWorkspacesTable } from "@/components/platform/OperationalWorkspacesTable";
import { PilotWorkspaceCreator } from "@/components/platform/PilotWorkspaceCreator";
import { PilotReviewerInvite } from "@/components/platform/PilotReviewerInvite";
import { getPlatformAuthContext, hasPlatformRole } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

export default async function PlatformWorkspacesPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const isRo = lang === "ro";
  const isFa = lang === "fa";
  const auth = await getPlatformAuthContext();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#1E3A5A] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-white md:text-2xl">
            <Building2
              className="h-6 w-6 text-emerald-400"
              aria-hidden="true"
            />
            <span>
              {isRo
                ? "Spații de Lucru Clienți & Ciclu de Viață"
                : isFa
                  ? "محیط‌های کاری مشتریان و چرخه حیات تجاری"
                  : "Customer Workspaces & Lifecycle"}
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-300 md:text-sm">
            {isRo
              ? "Date operaționale autorizate, limitate la spațiile de lucru alocate operatorului curent."
              : isFa
                ? "داده‌های عملیاتی مجاز، محدود به محیط‌های کاری تخصیص‌یافته به کاربر فعلی."
                : "Authorized operational data, limited to workspaces assigned to the current operator."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/40 bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-300 sm:self-auto">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN')
              ? (isRo ? 'Date live · operațiuni controlate' : isFa ? 'داده زنده · عملیات کنترل‌شده' : 'Live data · controlled actions')
              : (isRo ? 'Date live · doar citire' : isFa ? 'داده زنده · فقط خواندنی' : 'Live data · read only')}
          </span>
        </div>
      </div>
      {hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN') && <PilotWorkspaceCreator lang={lang} />}
      {hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN') && <PilotReviewerInvite lang={lang as 'ro'|'en'|'fa'} />}
      <OperationalWorkspacesTable lang={lang} canTransition={hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN')} />
    </div>
  );
}
