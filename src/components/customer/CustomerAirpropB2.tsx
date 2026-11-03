'use client';
import { useEffect, useState } from 'react';
import { managementPortfolioResponseV1Schema } from '@/lib/airprop/commercial-lifecycle-v1';
import { AIRPROP_B2_ID } from '@/lib/airprop/artifact-b2-contract';

/** Consume only this failed read response; never classify its body as authorization. */
async function consumeFailedRead(response: Response, signal: AbortSignal) {
 if(signal.aborted){void response.body?.cancel().catch(()=>{});throw new Error('AIRPROP_READ_UNAVAILABLE');}
 if(!response.body)throw new Error('AIRPROP_READ_UNAVAILABLE');
 const reader=response.body.getReader();
 let stop:()=>void=()=>{},complete=false,bytes=0;
 const interrupted=new Promise<never>((_,reject)=>{stop=()=>reject(new Error('AIRPROP_READ_UNAVAILABLE'));});
 const timer=setTimeout(stop,1500);
 signal.addEventListener('abort',stop,{once:true});
 try{
  while(true){
   const {done,value}=await Promise.race([reader.read(),interrupted]);
   if(done){complete=true;return;}
   bytes+=value.byteLength;
   if(bytes>16384)throw new Error('AIRPROP_READ_UNAVAILABLE');
  }
 }finally{
  clearTimeout(timer);signal.removeEventListener('abort',stop);
  // Do not await cancellation: a broken underlying stream may never settle it.
  if(!complete)void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}


const copy = {
  en: { title: 'Managed property portfolio', closed: 'Commercial commands are currently unavailable.', empty: 'No currently authorized managed property.', owner: 'Owner', scope: 'Scope', operations: 'Operations owns execution details.', finance: 'Finance is not connected.' },
  ro: { title: 'Portofoliu de proprietăți administrate', closed: 'Comenzile comerciale nu sunt disponibile momentan.', empty: 'Nicio proprietate administrată autorizată în prezent.', owner: 'Proprietar', scope: 'Domeniu', operations: 'Operations deține detaliile execuției.', finance: 'Finance nu este conectat.' },
  fa: { title: 'سبد ملک‌های تحت مدیریت', closed: 'فرمان‌های تجاری در حال حاضر در دسترس نیستند.', empty: 'ملک تحت مدیریتِ مجاز فعلی وجود ندارد.', owner: 'مالک', scope: 'محدوده', operations: 'جزئیات اجرا در مالکیت Operations است.', finance: 'اتصال Finance برقرار نیست.' },
};
const unavailable = { en: 'The managed portfolio is currently unavailable.', ro: 'Portofoliul administrat nu este disponibil momentan.', fa: 'سبد تحت مدیریت در حال حاضر در دسترس نیست.' };

/** Explicit selector binding; clear old views synchronously on any context/Workspace change. */
export function CustomerAirpropB2Workspace({ lang, contextId, workspaceId }: {
  lang: 'en' | 'ro' | 'fa'; contextId: string; workspaceId: string;
}) {
  const identity = `${contextId}:${workspaceId}`;
  const [result, setResult] = useState<{ identity: string; view: unknown } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    const query = new URLSearchParams({ context_id: contextId, workspace_id: workspaceId });
    async function read() {
      try {
        const response = await fetch(`/api/customer/v2/airprop/artifact-b2?${query}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) { await consumeFailedRead(response, controller.signal); throw new Error('AIRPROP_READ_UNAVAILABLE'); }
        const data = await response.json();
        const view = data?.artifact_id === AIRPROP_B2_ID && data?.commands === null && data?.can_edit === false
          && data?.state === 'pre_activation' ? data.view : null;
        if (current) setResult({ identity, view });
      } catch { if (current) setResult({ identity, view: null }); }
    }
    void read();
    return () => { current = false; controller.abort(); };
  }, [contextId, workspaceId, identity]);
  return <CustomerAirpropB2 lang={lang} view={result?.identity === identity ? result.view : null} commands={null} can_edit={false} />;
}
const scopeCopy = {
  en: { listing: 'Listing', lease_administration: 'Lease administration', maintenance_coordination: 'Maintenance coordination', owner_reporting: 'Owner reporting', rent_collection: 'Rent collection', supplier_coordination: 'Supplier coordination' },
  ro: { listing: 'Anunț', lease_administration: 'Administrarea închirierii', maintenance_coordination: 'Coordonarea întreținerii', owner_reporting: 'Raportarea către proprietar', rent_collection: 'Colectarea chiriei', supplier_coordination: 'Coordonarea furnizorilor' },
  fa: { listing: 'آگهی', lease_administration: 'مدیریت اجاره', maintenance_coordination: 'هماهنگی نگهداری', owner_reporting: 'گزارش به مالک', rent_collection: 'دریافت اجاره', supplier_coordination: 'هماهنگی تأمین‌کنندگان' },
};
const statusCopy = {
  en: { scheduled: 'Scheduled', assigned: 'Assigned', in_progress: 'In progress', blocked: 'Blocked', completed: 'Completed', verified: 'Verified' },
  ro: { scheduled: 'Programat', assigned: 'Atribuit', in_progress: 'În desfășurare', blocked: 'Blocat', completed: 'Finalizat', verified: 'Verificat' },
  fa: { scheduled: 'زمان‌بندی‌شده', assigned: 'واگذارشده', in_progress: 'در حال انجام', blocked: 'متوقف', completed: 'تکمیل‌شده', verified: 'تأییدشده' },
};
export function CustomerAirpropB2({ lang, view, commands, can_edit }: {
  lang: 'en' | 'ro' | 'fa'; view: unknown; commands: null; can_edit: false;
}) {
  const t = copy[lang], parsed = managementPortfolioResponseV1Schema.safeParse(view);
  // Even a forged JS caller cannot turn the read-only projection into a command surface.
  const properties = commands === null && can_edit === false && parsed.success ? parsed.data.properties : [];
  return <section aria-label={t.title} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-semibold">{t.title}</h2>
    <p role="status">{t.closed}</p>
    {properties.length === 0 ? <p>{parsed.success ? t.empty : unavailable[lang]}</p> : properties.map(item => <article key={item.mandate_request_id} className="space-y-2 rounded border p-3">
      <h3 className="font-semibold">{item.property.label}</h3>
      <p>{t.owner}: {item.owner.label}</p>
      <p>{t.scope}: {item.scope.capabilities.map(capability => scopeCopy[lang][capability]).join(', ')}</p>
      <p>{item.valid_from} – {item.valid_to}</p>
      <ul>{item.action_links.map(action => <li key={action.action_link_id}>{statusCopy[lang][action.source_status_snapshot]}</li>)}</ul>
    </article>)}
    <p>{t.operations}</p><p>{t.finance}</p>
  </section>;
}
