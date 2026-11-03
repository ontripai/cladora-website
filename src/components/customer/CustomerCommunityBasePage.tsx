'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerCommunityBase, type CommunityBaseCommands, type CommunityBaseView, type CommunityDraftGuard } from './CustomerCommunityBase';
import { classifyCommunityResponse, communityReadResponseSchema, newCommunityCommandIdentity, toCommunityViews, type CommunityLoadFailure } from '@/lib/community/community-base-client';

const copy = {
  ro: { unsavedTitle: 'Păstrezi modificările?', unsavedBody: 'Ai ciorne netrimise în comunitatea curentă. Renunți la ele pentru a schimba comunitatea?', keep: 'Continuă editarea', discard: 'Renunță și schimbă comunitatea', unavailable: 'Comunitatea selectată nu mai este disponibilă. Ciornele locale au fost șterse. Alege o comunitate disponibilă.', title: 'Comunitate', subtitle: 'Consultă anunțurile comunității și folosește numai acțiunile autorizate pentru contextul activ.', choose: 'Alege comunitatea', loading: 'Se încarcă comunitatea…', empty: 'Nu există comunități eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul Comunitate sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru Comunitate nu este încă activată.', retry: 'Comunitatea nu a putut fi încărcată.', again: 'Încearcă din nou' },
  en: { unsavedTitle: 'Keep your changes?', unsavedBody: 'You have unsent drafts in this community. Discard them to switch communities?', keep: 'Keep editing', discard: 'Discard and switch community', unavailable: 'The selected community is no longer available. Local drafts were cleared. Choose an available community.', title: 'Community', subtitle: 'Read community announcements and use only the actions authorized for the active context.', choose: 'Choose a community', loading: 'Loading community…', empty: 'No eligible communities are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The Community module or required permission is not active in this workspace.', notReady: 'The operational Community connection has not been activated yet.', retry: 'Community could not be loaded.', again: 'Try again' },
  fa: { unsavedTitle: 'تغییرات حفظ شوند؟', unsavedBody: 'در جامعهٔ فعلی پیش‌نویس ارسال‌نشده دارید. برای تغییر جامعه آن‌ها را کنار می‌گذارید؟', keep: 'ادامهٔ ویرایش', discard: 'کنارگذاشتن پیش‌نویس و تغییر جامعه', unavailable: 'جامعهٔ انتخاب‌شده دیگر در دسترس نیست. پیش‌نویس‌های محلی پاک شدند. جامعهٔ در دسترس دیگری انتخاب کنید.', title: 'جامعه', subtitle: 'اعلان‌های جامعه را ببینید و فقط اقدام‌های مجاز در زمینهٔ فعال را انجام دهید.', choose: 'انتخاب جامعه', loading: 'در حال دریافت جامعه…', empty: 'در این فضای کاری جامعهٔ واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول جامعه یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی جامعه هنوز فعال نشده است.', retry: 'دریافت جامعه ناموفق بود.', again: 'تلاش دوباره' },
} as const;

export function CustomerCommunityBasePage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext(); const t = copy[lang];
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={t.loading} />;
  if (!active || !dashboard) return <Notice lang={lang} text={t.noContext} />;
  return <CommunityWorkspace key={`${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function CommunityWorkspace({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const fetch = useDashboardFetch(); const t = copy[lang];
  const { registerUnsavedGuard, pendingContextId } = useCustomerContext();
  const [communities, setCommunities] = useState<CommunityBaseView[] | null>(null); const [selectedId, setSelectedId] = useState('');
  const selectorRef = useRef<HTMLSelectElement>(null);
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
    const revision = ++loadRevision.current;
    const response = await fetch(`/api/customer/v1/community/base?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(classifyCommunityResponse(response.status));
    const parsed = communityReadResponseSchema.parse(await response.json());
    if (parsed.workspace_id !== workspaceId || parsed.communities.some((community) => community.workspace_id !== workspaceId)) throw new Error('retry');
    const next = toCommunityViews(parsed, lang);
    if (!signal?.aborted && revision === loadRevision.current) {
      const firstLoad = !initialized.current;
      initialized.current = true;
      setCommunities(next);
      // Revocation never silently moves local drafts to the next community.
      setSelectedId((current) => next.some((community) => community.community_id === current) ? current : firstLoad ? next[0]?.community_id ?? '' : '');
      setPendingSelection((current) => current && next.some((community) => community.community_id === current.from) && next.some((community) => community.community_id === current.target) ? current : null);
      setFailure(null);
    }
  }, [contextId, workspaceId, fetch, lang]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) setFailure(reason instanceof Error && ['session', 'denied', 'not_ready'].includes(reason.message) ? reason.message as CommunityLoadFailure : 'retry');
    }));
    return () => controller.abort();
  }, [load, attempt]);
  const selected = communities?.find((community) => community.community_id === selectedId) ?? null;
  const send = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/customer/v1/community/base', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { if (response.status === 409) await load(); throw new Error(classifyCommunityResponse(response.status)); }
  }, [fetch, load]);
  const commands = useMemo<CommunityBaseCommands | null>(() => selected ? {
    createAnnouncement: ({ community_id, body }) => send({ ...newCommunityCommandIdentity(), type: 'create_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id: crypto.randomUUID(), expected_version: selected.version, body, audience: { kind: 'workspace' }, reason: 'Create Community announcement draft from customer workspace' }),
    publishAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'publish_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Publish Community announcement from customer workspace' }),
    cancelAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'cancel_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Cancel Community announcement from customer workspace' }),
    reportContent: ({ community_id, announcement_id, reason }) => send({ ...newCommunityCommandIdentity(), type: 'report_content', context_id: contextId, workspace_id: workspaceId, community_id, report_id: crypto.randomUUID(), target_type: 'announcement', target_id: announcement_id, expected_version: 0, report_reason: reason, reason: 'Report Community announcement from customer workspace' }),
    decideReport: ({ community_id, report_id, expected_version, decision, reason }) => send({ ...newCommunityCommandIdentity(), type: 'decide_content_report', context_id: contextId, workspace_id: workspaceId, community_id, report_id, expected_version, decision, decision_reason: reason, reason: 'Decide Community content report from customer workspace' }),
  } : null, [selected, contextId, workspaceId, send]);
  function requestSelection(target: string) {
    if (target === selectedId || !communities?.some((community) => community.community_id === target)) return;
    if (draftGuards.current.size) setPendingSelection({ from: selectedId, target });
    else { setPendingSelection(null); setSelectedId(target); }
  }
  function discardAndSelect() {
    if (!pendingSelection || pendingContextId !== null || pendingSelection.from !== selectedId
      || !communities?.some((community) => community.community_id === pendingSelection.target)) return;
    for (const entry of Array.from(draftGuards.current.values())) { entry.discard(); entry.unregister(); }
    draftGuards.current.clear();
    setSelectedId(pendingSelection.target);
    setPendingSelection(null);
  }
  // Context confirmation takes precedence. Cancelling it resumes the still-valid
  // local decision; an actual Context change unmounts this entire local scope.
  const showSelectionDialog = pendingContextId === null && pendingSelection?.from === selectedId
    && communities?.some((community) => community.community_id === pendingSelection.target);
  const failureMessage = failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.notReady : t.retry;
  const retryInitialLoad = failure === 'session' ? undefined : () => { setFailure(null); setAttempt((value) => value + 1); };
  const retryRefresh = failure === 'session' ? undefined : () => { void load().catch(() => setFailure('retry')); };
  if (failure && communities === null) return <Notice lang={lang} text={failureMessage} retry={retryInitialLoad} retryLabel={t.again} />;
  if (communities === null) return <Notice lang={lang} text={t.loading} />;
  return <section tabIndex={-1} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {failure ? <Notice lang={lang} text={failureMessage} retry={retryRefresh} retryLabel={t.again} alert /> : null}
    {!communities.length ? <Notice lang={lang} text={t.empty} /> : <>
      <label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#102A43]">{t.choose}</span>
        <select ref={selectorRef} aria-label={t.choose} value={selectedId} onChange={(event) => requestSelection(event.target.value)} className="w-full rounded-xl border p-3">
          <option value="" disabled>{t.choose}</option>
          {communities.map((community) => <option key={community.community_id} value={community.community_id}>{community.name}</option>)}
        </select>
      </label>
      {selected ? <CustomerCommunityBase key={`${workspaceId}:${selectedId}`} lang={lang} view={selected} commands={commands} registerDraftGuard={registerDraftGuard} onChanged={() => { void load().catch(() => setFailure('retry')); }} />
        : <Notice lang={lang} text={t.unavailable} />}
    </>}
    {showSelectionDialog ? <CommunitySelectionDialog lang={lang} onKeep={keepSelection} onDiscard={discardAndSelect} selectorRef={selectorRef} /> : null}
  </section>;
}

function CommunitySelectionDialog({ lang, onKeep, onDiscard, selectorRef }: {
  lang: Language; onKeep: () => void; onDiscard: () => void; selectorRef: RefObject<HTMLSelectElement | null>;
}) {
  const t = copy[lang];
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
      <h2 id={titleId} className="text-lg font-semibold">{t.unsavedTitle}</h2><p id={descriptionId}>{t.unsavedBody}</p>
      <div className="flex flex-wrap gap-3"><button ref={keepRef} type="button" onClick={onKeep} className="rounded-xl border px-4 py-2 font-semibold">{t.keep}</button><button type="button" onClick={onDiscard} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">{t.discard}</button></div>
    </div>
  </div>;
}

function Notice({ lang, text, retry, retryLabel, alert = false }: { lang: Language; text: string; retry?: () => void; retryLabel?: string; alert?: boolean }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role={alert ? 'alert' : 'status'} className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
