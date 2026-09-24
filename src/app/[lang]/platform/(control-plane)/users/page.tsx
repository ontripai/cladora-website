import React from 'react';
import { Users2 } from 'lucide-react';
import { OperationalPlatformUsersPanel } from '@/components/platform/OperationalPlatformUsersPanel';
import { OperatorManagement } from '@/components/platform/OperatorManagement';
import { getPlatformAuthContext, hasPlatformRole } from '@/lib/platform/auth';

export const dynamic = 'force-dynamic';

export default async function PlatformUsersPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';
  const auth = await getPlatformAuthContext();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E3A5A] pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Users2 className="w-6 h-6 text-emerald-400" />
            <span>
              {isRo
                ? 'Utilizatori Interni & Roluri Platformă'
                : isFa
                ? 'کاربران داخلی و نقش‌های پلتفرم'
                : 'Internal Platform Users & Roles'}
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            {isRo
              ? 'Gestiunea operatorilor interni CLADORA, rolurilor specifice și istoricului de acordare/revocare.'
              : isFa
              ? 'مدیریت کارشناسان داخلی کلادورا، تفکیک نقش‌ها و سوابق اعطا و لغو دسترسی‌ها.'
              : 'Management of internal CLADORA operators, explicit platform roles, and grant/revocation history.'}
          </p>
        </div>
      </div>

      {hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN') && <OperatorManagement lang={lang} />}
      <OperationalPlatformUsersPanel lang={lang} />
    </div>
  );
}
