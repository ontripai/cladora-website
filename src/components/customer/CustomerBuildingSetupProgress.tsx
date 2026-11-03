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
  return <section aria-label={t.title} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
    <h2 className="text-lg font-semibold">{t.title}</h2>
    {condition ? <p role="status" className="break-words">{t[condition]}</p> : <>
      {dirty && <p role="status" className="break-words font-semibold text-amber-800">{t.dirty}</p>}
      {saved ? <>
        <p role="status" className="break-words font-semibold">{t.stages[saved.status]}</p>
        <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt>{t.saved}</dt><dd className="break-words font-semibold">{saved.building}</dd></div>
          <div><dt>{t.units}</dt><dd>{saved.units}</dd></div>
          <div><dt>{t.version}</dt><dd>{saved.revision}</dd></div>
          <div className="min-w-0"><dt>{t.reference}</dt><dd className="break-all"><bdi dir="ltr">{saved.reference}</bdi></dd></div>
        </dl>
        <p className="break-words">{t.next[dirty && saved.status === 'draft' ? 'dirty' : saved.status]}</p>
        {(saved.status === 'rehearsed' || saved.status === 'submitted' || saved.status === 'approved' || saved.status === 'provisioned') && <p className="break-words text-sm text-slate-600">{t.rehearsal}</p>}
        {saved.status === 'provisioned' && canContinue && <a href={`/${lang}/app/dashboard`} className="inline-flex min-h-11 max-w-full items-center rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t.dashboard}</a>}
      </> : <><p role="status">{t.local}</p><p className="break-words">{t.next.edit}</p></>}
    </>}
  </section>;
}
