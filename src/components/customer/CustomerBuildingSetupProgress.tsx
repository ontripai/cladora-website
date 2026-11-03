'use client';

type Lang = 'en' | 'ro' | 'fa';
type SavedProgress = {
  status: 'draft' | 'rehearsed' | 'submitted' | 'approved' | 'provisioned' | 'cancelled';
  revision: number;
  reference: string;
  building: string;
  units: number;
};
const copy = {
  en: {
    title: 'Setup status and next step', local: 'No building details have been saved yet.', dirty: 'Changes on this form are not saved yet.',
    checking: 'Checking the current status. A past result does not confirm the current step.', unknown: 'The request result is still unknown. Your original request remains saved in this tab. Check the current status before sending the same request again.',
    blocked: 'Saved status could not be confirmed. Check access and status again; do not start a new request to bypass this problem.',
    saved: 'Building in the confirmed setup', version: 'Saved version', reference: 'Setup reference', units: 'Saved units',
    stages: {draft: 'Draft saved', rehearsed: 'Opening balances checked in a test', submitted: 'Sent to another reviewer for approval', approved: 'Approved by another reviewer; structure not created yet', provisioned: 'Building structure created', cancelled: 'Setup cancelled'},
    next: {edit: 'Check the building details, then use Create draft to save them.', draft: 'Check the saved units, then use Run rehearsal to test opening balances.', dirty: 'Save your unit changes before testing balances.', rehearsed: 'Send the saved details to another authorized person for approval.', submitted: 'Wait for another authorized reviewer to approve, then refresh the status here.', approved: 'Use Provision structure to record the approved building and units.', provisioned: 'Open the dashboard and choose an available working context. Creating this structure does not mean the platform is installed or a payment was made.', cancelled: 'This setup cannot continue. Review its status with an authorized manager.'},
    rehearsal: 'Testing balances does not post accounting entries or confirm a payment.', dashboard: 'Continue to dashboard',
  },
  ro: {
    title: 'Starea configurării și pasul următor', local: 'Nu ai salvat încă datele clădirii.', dirty: 'Modificările din formular nu sunt încă salvate.',
    checking: 'Se verifică starea actuală. Un rezultat anterior nu confirmă pasul curent.', unknown: 'Rezultatul cererii nu este încă clar. Cererea inițială rămâne salvată în această filă. Verifică starea actuală înainte să retrimiți aceeași cerere.',
    blocked: 'Starea salvată nu poate fi confirmată. Verifică din nou accesul și starea; nu începe altă cerere pentru a ocoli problema.',
    saved: 'Clădirea din configurarea confirmată', version: 'Versiune salvată', reference: 'Referință configurare', units: 'Unități salvate',
    stages: {draft: 'Ciornă salvată', rehearsed: 'Solduri inițiale verificate prin simulare', submitted: 'Trimis altei persoane pentru aprobare', approved: 'Aprobat de altă persoană; structura nu este încă creată', provisioned: 'Structura clădirii a fost creată', cancelled: 'Configurare anulată'},
    next: {edit: 'Verifică datele clădirii, apoi folosește Creează proiect pentru a le salva.', draft: 'Verifică unitățile salvate, apoi folosește Rulează simularea pentru soldurile inițiale.', dirty: 'Salvează modificările unităților înainte să testezi soldurile.', rehearsed: 'Trimite datele salvate altei persoane autorizate pentru aprobare.', submitted: 'Așteaptă aprobarea altei persoane autorizate, apoi actualizează starea aici.', approved: 'Folosește Creează structura pentru a înregistra clădirea și unitățile aprobate.', provisioned: 'Deschide panoul de control și alege un context la care ai acces. Structura creată nu înseamnă că platforma este instalată sau că s-a făcut o plată.', cancelled: 'Această configurare nu poate continua. Verifică starea cu un administrator autorizat.'},
    rehearsal: 'Testarea soldurilor nu înregistrează note contabile și nu confirmă o plată.', dashboard: 'Continuă la panoul de control',
  },
  fa: {
    title: 'وضعیت راه‌اندازی و قدم بعد', local: 'اطلاعات ساختمان هنوز ذخیره نشده است.', dirty: 'تغییرات فرم هنوز ذخیره نشده‌اند.',
    checking: 'در حال بررسی وضعیت فعلی؛ نتیجهٔ یک درخواست قبلی، مرحلهٔ فعلی را تأیید نمی‌کند.', unknown: 'نتیجهٔ درخواست هنوز مشخص نیست. درخواست اولیه در همین زبانه ذخیره مانده است. پیش از ارسال دوبارهٔ همان درخواست، وضعیت فعلی را بررسی کنید.',
    blocked: 'وضعیت ذخیره‌شده هنوز قابل تأیید نیست. دسترسی و وضعیت را دوباره بررسی کنید؛ برای عبور از این مشکل درخواست تازه‌ای نسازید.',
    saved: 'ساختمان در اطلاعات تأییدشده', version: 'نسخه ثبت‌شده', reference: 'شناسه راه‌اندازی', units: 'واحدهای ثبت‌شده',
    stages: {draft: 'پیش‌نویس ذخیره شد', rehearsed: 'مانده‌های شروع دوره آزمایش شدند', submitted: 'برای تأیید فرد دیگری ارسال شد', approved: 'فرد دیگری تأیید کرده است؛ ساختار هنوز ایجاد نشده است', provisioned: 'ساختار ساختمان ایجاد شد', cancelled: 'راه‌اندازی لغو شده است'},
    next: {edit: 'اطلاعات ساختمان را بررسی کنید و با «ایجاد پیش‌نویس» آن را ذخیره کنید.', draft: 'واحدهای ذخیره‌شده را بررسی کنید و سپس با «اجرای آزمایشی» مانده‌های شروع دوره را آزمایش کنید.', dirty: 'تغییرات واحدها را پیش از آزمایش مانده‌ها ذخیره کنید.', rehearsed: 'اطلاعات ذخیره‌شده را برای تأیید فرد مجاز دیگری بفرستید.', submitted: 'منتظر تأیید فرد مجاز دیگری بمانید و سپس وضعیت را در همین صفحه تازه کنید.', approved: 'با «ایجاد ساختار»، ساختمان و واحدهای تأییدشده را ثبت کنید.', provisioned: 'داشبورد را باز کنید و زمینهٔ کاریِ در دسترس خود را انتخاب کنید. ایجاد این ساختار به معنی نصب پلتفرم یا انجام پرداخت نیست.', cancelled: 'این راه‌اندازی قابل ادامه نیست. وضعیت را با مدیر مجاز بررسی کنید.'},
    rehearsal: 'آزمایش مانده‌ها به معنی ثبت سند حسابداری یا تأیید پرداخت نیست.', dashboard: 'ادامه در داشبورد',
  },
};

// Presentation only: the Wizard supplies current validated readback and owns all
// pending-command, scope, denial and receipt validation. No fetch or storage here.
export function CustomerBuildingSetupProgress({lang, saved, dirty, condition, canContinue}: {
  lang: Lang;
  saved: SavedProgress | null;
  dirty: boolean;
  condition: 'checking' | 'unknown' | 'blocked' | null;
  canContinue: boolean;
}) {
  const t = copy[lang];

  return (
    <section
      aria-label={t.title}
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-base sm:text-lg font-bold text-[#102A43] tracking-tight">{t.title}</h2>
        {!condition && saved && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600 motion-reduce:animate-none" />
            <span>{t.stages[saved.status]}</span>
          </span>
        )}
      </div>

      {condition ? (
        <div className={`p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed ${
          condition === 'checking'
            ? 'bg-slate-50 border-slate-200 text-slate-700'
            : condition === 'blocked'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <p role="status" className="break-words font-medium">{t[condition]}</p>
        </div>
      ) : (
        <>
          {dirty && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/80 text-xs sm:text-sm text-amber-900 font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <p role="status" className="break-words">{t.dirty}</p>
            </div>
          )}

          {saved ? (
            <>
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 text-xs sm:text-sm text-teal-900">
                <p role="status" className="break-words font-bold">{t.stages[saved.status]}</p>
              </div>

              <dl className="grid min-w-0 gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{t.saved}</dt>
                  <dd className="mt-1 break-words font-bold text-[#102A43]">{saved.building}</dd>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{t.units}</dt>
                  <dd className="mt-1 font-bold text-[#102A43]">{saved.units}</dd>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{t.version}</dt>
                  <dd className="mt-1 font-bold text-[#102A43]">{saved.revision}</dd>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{t.reference}</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-semibold text-[#334E68]"><bdi dir="ltr">{saved.reference}</bdi></dd>
                </div>
              </dl>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p className="break-words">{t.next[dirty && saved.status === 'draft' ? 'dirty' : saved.status]}</p>
              </div>

              {(saved.status === 'rehearsed' || saved.status === 'submitted' || saved.status === 'approved' || saved.status === 'provisioned') && (
                <p className="break-words text-xs text-slate-500 leading-relaxed px-1">{t.rehearsal}</p>
              )}

              {saved.status === 'provisioned' && canContinue && (
                <div className="pt-2">
                  <a
                    href={`/${lang}/app/dashboard`}
                    className="inline-flex min-h-[44px] max-w-full items-center justify-center rounded-xl bg-teal-800 hover:bg-teal-900 text-white px-5 py-2.5 text-sm font-bold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                  >
                    {t.dashboard}
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-700">
              <p role="status" className="font-semibold text-slate-900">{t.local}</p>
              <p className="break-words text-slate-600">{t.next.edit}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
