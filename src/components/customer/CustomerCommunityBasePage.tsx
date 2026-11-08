'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Ce010Command } from '@/lib/community/community-base-schema';
import { createCommunityCommandSession } from '@/lib/community/community-command-session';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerCommunityBase, type CommunityBaseCommands, type CommunityBaseView, type CommunityDraftGuard } from './CustomerCommunityBase';
import { classifyCommunityResponse, communityReadResponseSchema, newCommunityCommandIdentity, toCommunityViews, type CommunityLoadFailure } from '@/lib/community/community-base-client';

const copy = {
  ro: { unsavedTitle: 'Păstrezi modificările?', unsavedBody: 'Ai ciorne netrimise în comunitatea curentă. Renunți la ele pentru a schimba comunitatea?', keep: 'Continuă editarea', discard: 'Renunță și schimbă comunitatea', unavailable: 'Comunitatea selectată nu mai este disponibilă. Ciornele rămân în contextul comunității inițiale. Alege o comunitate disponibilă.', title: 'Comunitate', subtitle: 'Consultă anunțurile comunității și folosește numai acțiunile autorizate pentru contextul activ.', choose: 'Alege comunitatea', loading: 'Se încarcă comunitatea…', empty: 'Nu există comunități eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul Comunitate sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru Comunitate nu este încă activată.', retry: 'Comunitatea nu a putut fi încărcată.', again: 'Încearcă din nou' },
  en: { unsavedTitle: 'Keep your changes?', unsavedBody: 'You have unsent drafts in this community. Discard them to switch communities?', keep: 'Keep editing', discard: 'Discard and switch community', unavailable: 'The selected community is no longer available. Local drafts remain scoped to the original community. Choose an available community.', title: 'Community', subtitle: 'Read community announcements and use only the actions authorized for the active context.', choose: 'Choose a community', loading: 'Loading community…', empty: 'No eligible communities are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The Community module or required permission is not active in this workspace.', notReady: 'The operational Community connection has not been activated yet.', retry: 'Community could not be loaded.', again: 'Try again' },
  fa: { unsavedTitle: 'تغییرات حفظ شوند؟', unsavedBody: 'در جامعهٔ فعلی پیش‌نویس ارسال‌نشده دارید. برای تغییر جامعه آن‌ها را کنار می‌گذارید؟', keep: 'ادامهٔ ویرایش', discard: 'کنارگذاشتن پیش‌نویس و تغییر جامعه', unavailable: 'جامعهٔ انتخاب‌شده دیگر در دسترس نیست. پیش‌نویس‌ها در زمینهٔ جامعهٔ اولیه حفظ می‌شوند. جامعهٔ در دسترس دیگری انتخاب کنید.', title: 'جامعه', subtitle: 'اعلان‌های جامعه را ببینید و فقط اقدام‌های مجاز در زمینهٔ فعال را انجام دهید.', choose: 'انتخاب جامعه', loading: 'در حال دریافت جامعه…', empty: 'در این فضای کاری جامعهٔ واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول جامعه یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی جامعه هنوز فعال نشده است.', retry: 'دریافت جامعه ناموفق بود.', again: 'تلاش دوباره' },
} as const;

type CommunitySlot = { formRevision:number; session: ReturnType<typeof createCommunityCommandSession>; drafts: Map<string,string>; bridge: { fetch: typeof globalThis.fetch; owner:()=>object|null; changed:()=>void; denied:()=>void; announcementProtocol:()=>boolean } };
function reconcileSubmittedDraft(store:Map<string,string>, before:Map<string,string>, command:Ce010Command) {
  const expected:Record<string,string> = command.type==='create_announcement'?{'announcement.body':command.body}
    : command.type==='report_content'?{'report.target':command.target_id,'report.reason':command.report_reason}
    : command.type==='decide_content_report'?{'moderation.target':command.report_id,'moderation.decision':command.decision,'moderation.reason':command.decision_reason}:{};
  const fallback=(key:string)=>key==='moderation.decision'?'dismissed':'';
  if(Object.entries(expected).every(([key,value])=>(store.get(key)??fallback(key))===(before.get(key)??fallback(key)) && (store.get(key)??fallback(key)).trim()===value)) {
    Object.keys(expected).forEach(key=>store.delete(key));
  }
}
export function CustomerCommunityBasePage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext(); const t = copy[lang];
  const [slots] = useState(() => new Map<string,CommunitySlot>());
  const scopeOwner = useMemo(() => ({active,dashboard,loading,lang}),[active,dashboard,loading,lang]);
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={t.loading} />;
  if (!active || !dashboard || dashboard.contextId !== active.context_id) return <Notice lang={lang} text={t.noContext} />;
  return <CommunityWorkspace key={`${active.membership_id}:${active.context_id}:${dashboard.workspace_id}`} slots={slots} scopeOwner={scopeOwner} suspended={loading} membershipId={active.membership_id} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function CommunityWorkspace({ lang, contextId, workspaceId, membershipId, slots, scopeOwner, suspended }: { lang: Language; contextId: string; workspaceId: string; membershipId: string; slots: Map<string,CommunitySlot>; scopeOwner: object; suspended: boolean }) {
  const fetch = useDashboardFetch(); const t = copy[lang];
  const { registerUnsavedGuard, pendingContextId } = useCustomerContext();
  const [communities, setCommunities] = useState<CommunityBaseView[] | null>(null); const [selectedId, setSelectedId] = useState('');
  const selectorRef = useRef<HTMLSelectElement>(null);
  const owner = useRef<object|null>(null), readAdmission = useRef(false), scopeRef = useRef<object|null>(null);
  const nativeAnnouncementAdmission=useRef(false);
  const [reading,setReading] = useState(true);
  const [readViewOwner,setReadViewOwner] = useState<object|null>(null);
  const [,renderExecution] = useState(0);
  const token = useMemo(() => ({scopeOwner,selectedId,lang}),[scopeOwner,selectedId,lang]);
  const draftGuards = useRef(new Map<string, { discard: () => void; unregister: () => void }>());
  const [pendingSelection, setPendingSelection] = useState<{ from: string; target: string } | null>(null);
  const initialized = useRef(false);
  const loadRevision = useRef(0);
  const registerDraftGuard = useCallback<CommunityDraftGuard>((form, dirty, discard) => {
    const key = JSON.stringify(['ce-community', contextId, workspaceId, selectedId, form]);
    const entry = { discard, unregister: registerUnsavedGuard(key, dirty, discard) };
    if (dirty) draftGuards.current.set(key, entry);
    else draftGuards.current.delete(key);
    return () => {
      entry.unregister();
      if (draftGuards.current.get(key) === entry) draftGuards.current.delete(key);
    };
  }, [registerUnsavedGuard, contextId, workspaceId, selectedId]);
  const keepSelection = useCallback(() => setPendingSelection(null), []);
  const [failure, setFailure] = useState<CommunityLoadFailure | null>(null); const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    readAdmission.current=false; nativeAnnouncementAdmission.current=false; setReading(true);
    const revision = ++loadRevision.current;
    if(suspended)return;
    const valid=()=>!signal?.aborted && revision===loadRevision.current && scopeRef.current===scopeOwner && owner.current===token;
    try {
    const response = await fetch(`/api/customer/v1/community/base?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(classifyCommunityResponse(response.status));
    if (!valid()) return;
    const parsed = communityReadResponseSchema.parse(await response.json());
    if (parsed.workspace_id !== workspaceId || parsed.communities.some((community) => community.workspace_id !== workspaceId)) throw new Error('retry');
    const next = toCommunityViews(parsed, lang);
    if (valid()) {
      const firstLoad = !initialized.current;
      initialized.current = true;
      readAdmission.current=true;setReading(false);
      nativeAnnouncementAdmission.current=response.headers.get('X-Cladora-Community-Read')==='core-announcement-v1';
      setCommunities(previous=>valid()?next:previous);setReadViewOwner(previous=>valid()?scopeOwner:previous);
      // Revocation never silently moves local drafts to the next community.
      setSelectedId((current) => !valid()?current:next.some((community) => community.community_id === current) ? current : firstLoad ? next[0]?.community_id ?? '' : '');
      setPendingSelection((current) => !valid()?current:current && next.some((community) => community.community_id === current.from) && next.some((community) => community.community_id === current.target) ? current : null);
      setFailure(previous=>valid()?null:previous);
    }
    } catch(reason) {
      if(valid()){readAdmission.current=false;setReading(false);setFailure(reason instanceof Error && ['session','denied','not_ready'].includes(reason.message)?reason.message as CommunityLoadFailure:'retry');if(reason instanceof Error && ['session','denied'].includes(reason.message))setCommunities(null);}
    }
  }, [contextId, workspaceId, fetch, lang, scopeOwner, token, suspended]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load, attempt, scopeOwner]);
  const selected = communities?.find((community) => community.community_id === selectedId) ?? null;
  const slotKey=JSON.stringify([membershipId,contextId,workspaceId,selectedId]);
  const slot=(() => {
    const existing=slots.get(slotKey);if(existing)return existing;
    const bridge={fetch,owner:():object|null=>null,changed:()=>{},denied:()=>{},announcementProtocol:()=>false};
    const created:CommunitySlot={formRevision:0,drafts:new Map(),bridge,session:createCommunityCommandSession({contextId,workspaceId,communityId:selectedId,fetch:(...args)=>bridge.fetch(...args),
      owner:()=>bridge.owner(),changed:()=>bridge.changed(),denied:()=>bridge.denied(),announcementProtocol:()=>bridge.announcementProtocol()})};slots.set(slotKey,created);return created;
  })();
  useLayoutEffect(()=>{
    readAdmission.current=false;scopeRef.current=scopeOwner;owner.current=token;
    Object.assign(slot.bridge,{fetch,announcementProtocol:()=>nativeAnnouncementAdmission.current,owner:()=>owner.current===token && !suspended && readAdmission.current ? token : null,
      changed:()=>renderExecution(n=>n+1), denied:()=>{readAdmission.current=false;setFailure('denied');setCommunities(null);}});
    return ()=>{owner.current=null;scopeRef.current=null;slot.session.invalidate();};
  },[token,scopeOwner,suspended,slot,fetch]);
  const execution=slot.session.getState();
  const pendingScope=JSON.stringify([membershipId,contextId,workspaceId]);
  const hasPending=Array.from(slots.entries()).some(([key,value])=>key.startsWith(pendingScope.slice(0,-1)+',') && Boolean(value.session.getState().pending));
  useEffect(()=>registerUnsavedGuard('ce010-pending:'+pendingScope,hasPending,()=>{}),[registerUnsavedGuard,pendingScope,hasPending]);
  const send=useCallback((payload:Record<string,unknown>)=>slot.session.send(payload),[slot]);
  const commands = useMemo<CommunityBaseCommands | null>(() => selected ? {
    canEdit: () => Boolean(slot.bridge.owner()) && !slot.session.getState().pending,
    canDiscard: () => !slot.session.getState().pending || slot.session.getState().phase==='rejected',
    createAnnouncement: ({ community_id, body }) => send({ ...newCommunityCommandIdentity(), type: 'create_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id: crypto.randomUUID(), expected_version: selected.version, body, audience: { kind: 'workspace' }, reason: 'Create Community announcement draft from customer workspace' }),
    publishAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'publish_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Publish Community announcement from customer workspace' }),
    cancelAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'cancel_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Cancel Community announcement from customer workspace' }),
    reportContent: ({ community_id, announcement_id, reason }) => send({ ...newCommunityCommandIdentity(), type: 'report_content', context_id: contextId, workspace_id: workspaceId, community_id, report_id: crypto.randomUUID(), target_type: 'announcement', target_id: announcement_id, expected_version: 0, report_reason: reason, reason: 'Report Community announcement from customer workspace' }),
    decideReport: ({ community_id, report_id, expected_version, decision, reason }) => send({ ...newCommunityCommandIdentity(), type: 'decide_content_report', context_id: contextId, workspace_id: workspaceId, community_id, report_id, expected_version, decision, decision_reason: reason, reason: 'Decide Community content report from customer workspace' }),
  } : null, [selected, contextId, workspaceId, send, slot]);
  function requestSelection(target: string) {
    if (target === selectedId || !communities?.some((community) => community.community_id === target)) return;
    if (draftGuards.current.size || execution.pending) setPendingSelection({ from: selectedId, target });
    else { owner.current=null; slot.session.invalidate();setPendingSelection(null); setSelectedId(target);setAttempt(n=>n+1); }
  }
  function discardAndSelect() {
    if (!pendingSelection || pendingContextId !== null || pendingSelection.from !== selectedId
      || !communities?.some((community) => community.community_id === pendingSelection.target)) return;
    for (const entry of Array.from(draftGuards.current.values())) { entry.discard(); entry.unregister(); }
    draftGuards.current.clear();
    owner.current=null;slot.session.invalidate();setSelectedId(pendingSelection.target);setAttempt(n=>n+1);
    setPendingSelection(null);
  }
  // Context confirmation takes precedence. Cancelling it resumes the still-valid
  // local decision; an actual Context change unmounts this entire local scope.
  const showSelectionDialog = pendingContextId === null && pendingSelection?.from === selectedId
    && communities?.some((community) => community.community_id === pendingSelection.target);
  const failureMessage = failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.notReady : t.retry;
  const retryInitialLoad = failure === 'session' ? undefined : () => { setFailure(null); setAttempt((value) => value + 1); };
  const retryRefresh = failure === 'session' ? undefined : () => { void load(); };
  if (failure && communities === null) return <Notice lang={lang} text={failureMessage} retry={retryInitialLoad} retryLabel={t.again} />;
  if (communities === null || readViewOwner!==scopeOwner) return <Notice lang={lang} text={t.loading} />;
  return <section tabIndex={-1} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="min-w-0 max-w-full space-y-5">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {failure ? <Notice lang={lang} text={failureMessage} retry={retryRefresh} retryLabel={t.again} alert /> : null}
    {!communities.length ? <Notice lang={lang} text={t.empty} /> : <>
      <label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#102A43]">{t.choose}</span>
        <select ref={selectorRef} aria-label={t.choose} value={selectedId} onChange={(event) => requestSelection(event.target.value)} className="w-full rounded-xl border p-3">
          <option value="" disabled>{t.choose}</option>
          {communities.map((community) => <option key={community.community_id} value={community.community_id}>{community.name}</option>)}
        </select>
      </label>
      <button data-community-refresh type="button" disabled={suspended || execution.phase==='sending'} onClick={()=>void load()}>{lang==='fa'?'بازخوانی وضعیت فعلی جامعه':lang==='ro'?'Reîncarcă starea curentă a comunității':'Refresh current community'}</button>
      <p role="status" aria-live="polite" data-community-command-status>{execution.phase==='unknown' ? (lang==='fa'?'نتیجه نامعلوم است؛ درخواست اصلی تا بازبودن این صفحه حفظ می‌شود. بازخوانی اثبات فرمان نیست و بارگذاری مجدد آن را بازیابی نمی‌کند.':lang==='ro'?'Rezultat necunoscut; cererea originală este păstrată cât timp pagina rămâne deschisă. Citirea nu dovedește comanda; reîncărcarea paginii nu o recuperează.':'Result unknown; original request retained while this page stays open. Current reads do not prove this command; reload cannot recover it.') : execution.phase==='done' ? (lang==='fa'?'نتیجه فرمان تأیید شد.':lang==='ro'?'Rezultatul comenzii este confirmat.':'Command result confirmed.') : execution.phase==='rejected' ? (lang==='fa'?'درخواست رد شد؛ ورودی حفظ شد.':lang==='ro'?'Cererea a fost respinsă; datele sunt păstrate.':'Request rejected; input retained.') : execution.phase==='sending' ? (lang==='fa'?'در حال ارسال…':lang==='ro'?'Se trimite…':'Sending…') : ''}</p>
      {execution.notReady ? <Notice lang={lang} text={t.notReady} /> : null}
      {execution.phase==='unknown' ? <button data-community-replay type="button" disabled={reading || Boolean(failure) || suspended} onClick={()=>{
        const admittedOwner=slot.bridge.owner(), pending=slot.session.getState().pending, before=new Map(slot.drafts);
        void slot.session.replay().then(ok=>{
          if(ok && admittedOwner && slot.bridge.owner()===admittedOwner && pending){
            reconcileSubmittedDraft(slot.drafts,before,pending.command);
            Object.assign(slot,{formRevision:slot.formRevision+1});renderExecution(n=>n+1);void load();
          }
        });
      }}>{lang==='fa'?'ارسال صریح همان درخواست':lang==='ro'?'Retrimite explicit aceeași cerere':'Explicitly resend the same request'}</button> : null}
      {execution.phase==='rejected' ? <button data-community-reset type="button" onClick={()=>slot.session.resetRejected()}>{lang==='fa'?'ویرایش پس از رد':lang==='ro'?'Editează după respingere':'Edit after rejection'}</button> : null}
      <fieldset className="min-w-0 max-w-full" disabled={reading || suspended || Boolean(failure) || Boolean(execution.pending)}>
      {selected ? <CustomerCommunityBase key={`${workspaceId}:${selectedId}:${lang}:${slot.formRevision}`} lang={lang} view={selected} commands={commands} registerDraftGuard={registerDraftGuard} draftStore={slot.drafts} onChanged={() => { void load(); }} />
        : <Notice lang={lang} text={t.unavailable} />}
      </fieldset>
    </>}
    {showSelectionDialog ? <CommunitySelectionDialog lang={lang} pendingCommand={execution.phase==='sending'||execution.phase==='unknown'} onKeep={keepSelection} onDiscard={discardAndSelect} selectorRef={selectorRef} /> : null}
  </section>;
}

function CommunitySelectionDialog({ lang, onKeep, onDiscard, selectorRef, pendingCommand = false }: {
  lang: Language; onKeep: () => void; onDiscard: () => void; selectorRef: RefObject<HTMLSelectElement | null>; pendingCommand?: boolean;
}) {
  const t = copy[lang];
  const pendingBody = lang==='fa'?'درخواست اصلی در جامعهٔ قبلی معلق می‌ماند. تغییر جامعه آن را حذف، لغو یا دوباره ارسال نمی‌کند.':lang==='ro'?'Cererea originală rămâne în așteptare în comunitatea anterioară. Schimbarea nu o șterge, anulează sau retrimite.':'The original request stays pending in the previous community. Switching does not discard, cancel or resend it.';
  const pendingSwitch = lang==='fa'?'حفظ درخواست معلق و تغییر جامعه':lang==='ro'?'Păstrează cererea și schimbă comunitatea':'Keep pending request and switch community';
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleId = useId(); const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const selector = selectorRef.current;
    const page = dialog?.closest<HTMLElement>('section');
    if (!dialog) return;
    const outside = new Map<Element, string | null>();
    // Follow the existing AIRPROP interaction pattern: inert every branch
    // outside the dialog, including the surrounding shell, then restore it.
    let branch: Element = dialog;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch) { outside.set(sibling, sibling.getAttribute('inert')); sibling.setAttribute('inert', ''); }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    const focusKeep = () => keepRef.current?.focus();
    const blockOutside = (event: Event) => {
      if (event.target instanceof window.Node && !dialog.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof window.Node && !dialog.contains(event.target)) focusKeep();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onKeep(); }
      else if (event.key === 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation();
        const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.findIndex((button) => button === document.activeElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else blockOutside(event);
    };
    const blockedEvents = ['pointerdown', 'click', 'submit'];
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('focusin', containFocus, true);
    for (const name of blockedEvents) document.addEventListener(name, blockOutside, true);
    focusKeep();
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('focusin', containFocus, true);
      for (const name of blockedEvents) document.removeEventListener(name, blockOutside, true);
      outside.forEach((inert, element) => { if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert); });
      if (selector?.isConnected) selector.focus();
      else if (page?.isConnected) page.focus();
    };
  }, [onKeep, selectorRef]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="max-w-lg space-y-4 rounded-2xl border border-amber-500 bg-white p-6 text-slate-950 shadow-xl">
      <h2 id={titleId} className="text-lg font-semibold">{t.unsavedTitle}</h2><p id={descriptionId}>{pendingCommand?pendingBody:t.unsavedBody}</p>
      <div className="flex flex-wrap gap-3"><button ref={keepRef} type="button" onClick={onKeep} className="rounded-xl border px-4 py-2 font-semibold">{t.keep}</button><button type="button" onClick={onDiscard} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">{pendingCommand?pendingSwitch:t.discard}</button></div>
    </div>
  </div>;
}

function Notice({ lang, text, retry, retryLabel, alert = false }: { lang: Language; text: string; retry?: () => void; retryLabel?: string; alert?: boolean }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role={alert ? 'alert' : 'status'} className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
