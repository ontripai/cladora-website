import { Archive } from 'lucide-react';
import { OperationalRetentionPanel } from '@/components/platform/OperationalRetentionPanel';

export const dynamic = 'force-dynamic';

export default async function RetentionOperationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="border-b border-[#1E3A5A] pb-6">
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-white md:text-2xl">
          <Archive className="h-6 w-6 text-emerald-400" />
          <span>{isRo ? 'Retenție, Arhivare & Legal Hold' : isFa ? 'نگهداری، آرشیو و دستور حقوقی' : 'Retention, Archive & Legal Hold'}</span>
        </h1>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-300 md:text-sm">
          {isRo
            ? 'Control operațional AAL2, strict read-only, cu vizibilitate limitată prin alocări și previzualizare Worker fără efecte.'
            : isFa
              ? 'کنترل عملیاتی محافظت‌شده با AAL2، کاملاً فقط‌خواندنی و محدود به تخصیص‌های مجاز؛ پیش‌نمایش Worker هیچ اثر جانبی ندارد.'
              : 'AAL2-protected, strictly read-only operational control with assignment-scoped visibility and a side-effect-free worker preview.'}
        </p>
      </div>
      <OperationalRetentionPanel lang={lang} />
    </div>
  );
}
