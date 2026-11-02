'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCustomerContext } from './CustomerContextProvider';
import { listingCommandSchema, listingReadResponseSchema, matchesListingReceipt, readListingRecovery,
  listingActionAvailable, sameId, sameSelection, writeListingRecovery, type ListingCommand, type ListingReadResponse, type ListingView } from '@/lib/airprop/listing-flow-contract-v1';

const copy = {
  ro: { denied: 'Nu ai dreptul să faci această modificare.', unavailableAction: 'Dreptul pentru această modificare nu a putut fi verificat.', title: 'Anunțuri pentru proprietăți', source: 'Proprietatea din evidența autorizată', choose: 'Alege un anunț', refresh: 'Verifică din nou', empty: 'Nu există anunțuri disponibile în acest context.', unavailable: 'Anunțurile nu sunt disponibile. Verifică accesul și încearcă din nou.', notReady: 'Conexiunea cu sursa autorizată nu este pregătită. Nu a fost trimisă nicio modificare.', readOnly: 'Poți consulta anunțul. Modificările așteaptă conectarea și verificarea autorizării.', loading: 'Se verifică accesul…', published: 'Publicat', withdrawn: 'Retras', reserved: 'Rezervat', person: 'Persoană fizică', company: 'Persoană juridică', ownership: 'Proprietate', management: 'Administrare', representation: 'Reprezentare', party: 'Relație verificată de sursa comună', start: 'Disponibil din', end: 'Disponibil până la (opțional)', reason: 'Motivul modificării (minimum 8 caractere)', edit_listing: 'Salvează perioada', withdraw_listing: 'Retrage anunțul', republish_listing: 'Publică din nou', invalid: 'Verifică perioada și motivul. Datele introduse au fost păstrate.', conflict: 'Versiunea sau relația s-a schimbat. Cererea este blocată; nu crea o cerere nouă. Cere verificarea acestei cereri.', unknown: 'Rezultatul nu este cunoscut. Modificarea poate fi salvată. Reîncearcă numai aceeași cerere.', retry: 'Reîncearcă aceeași cerere', saved: 'Rezultatul cererii a fost primit. Starea actuală este verificată separat.', stale: 'Anunțul s-a schimbat. Datele introduse sunt păstrate; renunță la ele și verifică versiunea nouă înainte de trimitere.', discard: 'Renunță la modificările locale', unsaved: 'Renunți la modificările nesalvate?', keep: 'Continuă editarea', switch: 'Renunță și schimbă anunțul', storage: 'Cererea nu poate fi recuperată în siguranță. Nu reîncerca după reîncărcare; cere ajutor.', limits: 'Un anunț nu este un contract, o rezervare confirmată sau o plată. Nu este afișată o evaluare de piață.' },
  en: { denied: 'You do not have permission for this change.', unavailableAction: 'Permission for this change could not be verified.', title: 'Property listings', source: 'Property from the authorized source', choose: 'Choose a listing', refresh: 'Check again', empty: 'No listings are available in this context.', unavailable: 'Listings are unavailable. Check access and try again.', notReady: 'The authorized source connection is not ready. No change was sent.', readOnly: 'You can read this listing. Changes await the authorization connection and its verification.', loading: 'Checking access…', published: 'Published', withdrawn: 'Withdrawn', reserved: 'Reserved', person: 'Individual', company: 'Legal entity', ownership: 'Ownership', management: 'Management', representation: 'Representation', party: 'Relationship verified by the shared source', start: 'Available from', end: 'Available until (optional)', reason: 'Reason for change (at least 8 characters)', edit_listing: 'Save availability', withdraw_listing: 'Withdraw listing', republish_listing: 'Publish again', invalid: 'Check the dates and reason. Your input has been kept.', conflict: 'The version or relationship changed. This request is blocked; do not create a new request. Ask for this request to be reviewed.', unknown: 'The result is unknown. The change may be saved. Retry only the same request.', retry: 'Retry the same request', saved: 'The command result was received. Current state is checked separately.', stale: 'This listing changed. Your input is kept; discard it and check the new version before sending.', discard: 'Discard local edits', unsaved: 'Discard unsaved edits?', keep: 'Keep editing', switch: 'Discard and switch listing', storage: 'This request cannot be recovered safely. Do not retry after reloading; ask for help.', limits: 'A listing is not a contract, a confirmed reservation or a payment. No market valuation is displayed.' },
  fa: { denied: 'اختیار انجام این تغییر را ندارید.', unavailableAction: 'اختیار این تغییر قابل بررسی نیست.', title: 'آگهی‌های ملک', source: 'ملک از منبع مجاز', choose: 'یک آگهی انتخاب کنید', refresh: 'بررسی دوباره', empty: 'آگهی در دسترس این زمینه وجود ندارد.', unavailable: 'آگهی‌ها در دسترس نیستند. دسترسی را بررسی و دوباره تلاش کنید.', notReady: 'اتصال منبع مجاز آماده نیست. هیچ تغییری ارسال نشد.', readOnly: 'آگهی قابل خواندن است. تغییرات منتظر اتصال و بررسی اختیار هستند.', loading: 'در حال بررسی دسترسی…', published: 'منتشرشده', withdrawn: 'متوقف‌شده', reserved: 'رزروشده', person: 'شخص حقیقی', company: 'شخص حقوقی', ownership: 'مالکیت', management: 'مدیریت', representation: 'نمایندگی', party: 'رابطه بررسی‌شده در منبع مشترک', start: 'آغاز دسترس‌پذیری', end: 'پایان دسترس‌پذیری (اختیاری)', reason: 'دلیل تغییر (حداقل ۸ نویسه)', edit_listing: 'ذخیره بازه', withdraw_listing: 'توقف آگهی', republish_listing: 'انتشار دوباره', invalid: 'بازه و دلیل را بررسی کنید. ورودی شما حفظ شده است.', conflict: 'نسخه یا رابطه تغییر کرده است. این درخواست مسدود است؛ درخواست جدید نسازید. برای بررسی همین درخواست کمک بگیرید.', unknown: 'نتیجه نامشخص است؛ ممکن است تغییر ذخیره شده باشد. فقط همان درخواست را تکرار کنید.', retry: 'تکرار همان درخواست', saved: 'نتیجه فرمان دریافت شد. وضعیت فعلی جداگانه بررسی می‌شود.', stale: 'آگهی تغییر کرده است. ورودی حفظ شده؛ پیش از ارسال، تغییرات محلی را کنار بگذارید و نسخه جدید را بررسی کنید.', discard: 'کنارگذاشتن تغییرات محلی', unsaved: 'تغییرات ذخیره‌نشده کنار گذاشته شوند؟', keep: 'ادامه ویرایش', switch: 'کنارگذاشتن و تغییر آگهی', storage: 'بازیابی امن این درخواست ممکن نیست. پس از بارگذاری دوباره تکرار نکنید؛ کمک بگیرید.', limits: 'آگهی قرارداد، رزرو تأییدشده یا پرداخت نیست. ارزش‌گذاری بازار نمایش داده نمی‌شود.' },
};
type Props = { lang: 'ro' | 'en' | 'fa'; contextId: string; workspaceId: string; membershipId: string;
  registerDraftGuard: (dirty: boolean, discard: () => void) => () => void };
const endpoint = '/api/customer/v2/airprop/listings';
const localTime = (iso: string | null) => iso === null ? '' : new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
type Recovery = ReturnType<typeof readListingRecovery>;

export function CustomerAirpropListings(props: Props) {
  return <ListingEditor key={`${props.membershipId}:${props.contextId}:${props.workspaceId}`} {...props} />;
}
function ListingEditor({ lang, contextId, workspaceId, membershipId, registerDraftGuard }: Props) {
  const t = copy[lang], { registerUnsavedGuard } = useCustomerContext();
  const scope = { context_id: contextId, workspace_id: workspaceId };
  const storageKey = `cladora.airprop-listing.v1:${membershipId}:${contextId}:${workspaceId}`;
  const [view, setView] = useState<ListingReadResponse | null>(null), [selected, setSelected] = useState<ListingView | null>(null);
  const [from, setFrom] = useState(''), [until, setUntil] = useState(''), [reason, setReason] = useState('');
  const [recovery, setRecovery] = useState<Recovery>({ state: 'empty', wire: null });
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState<keyof typeof t | ''>('');
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const owner = useRef({ live: true, read: 0, writing: false });
  const selectRef = useRef<HTMLSelectElement>(null), keepRef = useRef<HTMLButtonElement>(null);
  const dirty = !!reason || (!!selected && (from !== localTime(selected.available_from) || until !== localTime(selected.available_until)));
  const dirtyRef = useRef(dirty);
  useLayoutEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  const select = useCallback((row: ListingView | null) => { setSelected(row); setFrom(localTime(row?.available_from ?? null)); setUntil(localTime(row?.available_until ?? null)); setReason(''); }, []);
  const discard = useCallback(() => { setSelected(null); setFrom(''); setUntil(''); setReason(''); }, []);
  const guarded = dirty || recovery.state !== 'empty';
  useEffect(() => registerUnsavedGuard(`airprop-listing:${storageKey}`, guarded, discard), [registerUnsavedGuard, storageKey, guarded, discard]);
  useEffect(() => registerDraftGuard(guarded, discard), [registerDraftGuard, guarded, discard]);
  useLayoutEffect(() => { const current = owner.current; current.live = true; return () => { current.live = false; current.read++; }; }, []);
  useEffect(() => { if (switchTo !== null) keepRef.current?.focus(); }, [switchTo]);
  const refresh = useCallback(async () => {
    const current = owner.current, ticket = ++current.read;
    const live = () => current.live && current.read === ticket;
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store' });
      const body: unknown = await response.json();
      if (!live()) return;
      if (!response.ok) { setView(null); setSelected(null); setMessage(response.status === 503 ? 'notReady' : 'unavailable'); return; }
      const result = listingReadResponseSchema.safeParse(body);
      if (!result.success || !sameId(result.data.context_id, contextId) || !sameId(result.data.workspace_id, workspaceId)) throw Error();
      setView(result.data);
      setSelected(old => {
        const row = result.data.listings.find(x => old && sameId(x.selection.listing_id, old.selection.listing_id));
        if (!row) return null;
        if (dirtyRef.current) return old;
        setFrom(localTime(row.available_from)); setUntil(localTime(row.available_until));
        return row;
      });
    } catch { if (live()) { setView(null); setSelected(null); setMessage('unavailable'); } }
  }, [contextId, workspaceId]);
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(async () => {
      if (!current) return;
      await refresh();
      if (!current) return;
      try { setRecovery(readListingRecovery(sessionStorage.getItem(storageKey), { context_id: contextId, workspace_id: workspaceId })); }
      catch { setRecovery({ state: 'invalid', wire: null }); }
      setReady(true);
    });
    return () => { current = false; };
  }, [storageKey, contextId, workspaceId, refresh]);
  const row = view?.listings.find(x => selected && sameId(x.selection.listing_id, selected.selection.listing_id));
  const stale = !!selected && (!row || !sameSelection(row.selection, selected.selection));
  const pending = recovery.state !== 'empty';
  let retryAvailable = false;
  if (recovery.state === 'uncertain') {
    try { retryAvailable = listingActionAvailable(view, listingCommandSchema.parse(JSON.parse(recovery.wire)), true); } catch { /* fail closed */ }
  }
  const store = (wire: string, state: 'uncertain' | 'blocked') => {
    const previous = readListingRecovery(sessionStorage.getItem(storageKey), scope);
    if (previous.state === 'invalid' || (previous.wire !== null && previous.wire !== wire)) throw Error();
    const encoded = writeListingRecovery(wire, state); sessionStorage.setItem(storageKey, encoded);
    if (sessionStorage.getItem(storageKey) !== encoded) throw Error();
    setRecovery({ state, wire });
  };
  async function send(wire: string) {
    const current = owner.current;
    if (!current.live || current.writing || !ready) return;
    let request: ListingCommand;
    try {
      request = listingCommandSchema.parse(JSON.parse(wire));
      if (!listingActionAvailable(view, request, recovery.state === 'uncertain' && recovery.wire === wire)) return;
      const stored = readListingRecovery(sessionStorage.getItem(storageKey), scope);
      if (stored.state === 'blocked' || stored.state === 'invalid') throw Error();
      store(wire, 'uncertain');
    }
    catch { setRecovery({ state: 'invalid', wire: null }); setMessage('storage'); return; }
    current.writing = true; setBusy(true); current.read++;
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: wire });
      const body = await response.json();
      if (!current.live) return;
      if (response.ok && matchesListingReceipt(body, request)) {
        const stored = readListingRecovery(sessionStorage.getItem(storageKey), scope);
        if (stored.state !== 'uncertain' || stored.wire !== wire) throw Error();
        sessionStorage.removeItem(storageKey); setRecovery({ state: 'empty', wire: null });
        discard(); setMessage('saved'); setView(null); void refresh();
      } else if (response.status === 409 && body?.error?.code !== 'READBACK_REQUIRED') {
        try { store(wire, 'blocked'); setMessage('conflict'); }
        catch { setRecovery({ state: 'invalid', wire: null }); setMessage('storage'); }
      } else {
        setMessage('unknown');
        if (response.status === 401 || response.status === 403) { current.read++; setView(null); setSelected(null); setMessage('unavailable'); }
      }
    } catch { if (current.live) setMessage('unknown'); }
    finally { current.writing = false; if (current.live) setBusy(false); }
  }
  function command(action: 'edit_listing' | 'withdraw_listing' | 'republish_listing') {
    if (!selected || stale || pending || busy || owner.current.writing || row?.actions[action] !== 'allowed') return;
    try {
      const value = { version: 1 as const, ...scope, action, listing_id: selected.selection.listing_id,
        expected_version: selected.selection.listing_version, idempotency_key: `listing-${crypto.randomUUID()}`, reason,
        ...(action === 'withdraw_listing' ? {} : {
          available_from: from === localTime(selected.available_from) ? selected.available_from : new Date(from).toISOString(),
          available_until: until === localTime(selected.available_until) ? selected.available_until : until ? new Date(until).toISOString() : null }) };
      const request = listingCommandSchema.parse({ contract: 'airprop-listing-flow.v1', selection: selected.selection, command: value });
      void send(JSON.stringify(request));
    } catch { setMessage('invalid'); }
  }
  return <section aria-label={t.title} className="space-y-3 rounded border p-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
    <h2 className="text-lg font-semibold">{t.title}</h2><p>{t.limits}</p>
    <button type="button" onClick={() => void refresh()} disabled={busy}>{t.refresh}</button>
    {message && <p role="status">{t[message]}</p>}
    {recovery.state === 'blocked' && <p role="alert">{t.conflict}</p>}
    {recovery.state === 'invalid' && <p role="alert">{t.storage}</p>}
    {recovery.state === 'uncertain' && <div><p>{t.unknown}</p><button type="button" disabled={!ready || busy || !retryAvailable} onClick={() => void send(recovery.wire)}>{t.retry}</button></div>}
    {!ready ? <p>{t.loading}</p> : view && <>
      {!view.can_edit && <p>{t.readOnly}</p>}
      {!view.listings.length ? <p>{t.empty}</p> : <label>{t.choose}<select ref={selectRef} value={selected?.selection.listing_id ?? ''} disabled={pending || busy} onChange={event => {
        const id = event.target.value;
        if (dirty) setSwitchTo(id); else select(view.listings.find(x => x.selection.listing_id === id) ?? null);
      }}><option value="">—</option>{view.listings.map(item => <option key={item.selection.listing_id} value={item.selection.listing_id}>{item.source_name}</option>)}</select></label>}
      {selected && <div><h3>{t.source}: {selected.source_name}</h3><p>{t[selected.status]}</p><p>{t.party}: {t[selected.selection.party_kind]} · {t[selected.selection.relationship_kind]}</p>
        {row && !Object.values(row.actions).includes('allowed') && <p>{t.readOnly}</p>}
        {stale && <p role="alert">{t.stale}</p>}
        <label>{t.start}<input aria-label={t.start} type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} disabled={pending || busy} /></label>
        <label>{t.end}<input aria-label={t.end} type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} disabled={pending || busy} /></label>
        <label>{t.reason}<input aria-label={t.reason} value={reason} onChange={e => setReason(e.target.value)} disabled={pending || busy} maxLength={500} /></label>
        {(['edit_listing', 'withdraw_listing', 'republish_listing'] as const).filter(action => action === 'republish_listing' ? selected.status === 'withdrawn' : selected.status === 'published').map(action =>
          <div key={action}><button type="button" disabled={!ready || row?.actions[action] !== 'allowed' || stale || pending || busy} onClick={() => command(action)}>{t[action]}</button>
            {row?.actions[action] !== 'allowed' && <p>{t[row?.actions[action] === 'denied' ? 'denied' : 'unavailableAction']}</p>}</div>)}
        {!pending && <button type="button" onClick={discard} disabled={busy}>{t.discard}</button>}
      </div>}
    </>}
    {switchTo !== null && <div role="alertdialog" aria-label={t.unsaved} onKeyDown={event => { if (event.key === 'Escape') { setSwitchTo(null); selectRef.current?.focus(); } }}>
      <p>{t.unsaved}</p><button ref={keepRef} type="button" onClick={() => { setSwitchTo(null); selectRef.current?.focus(); }}>{t.keep}</button>
      <button type="button" onClick={() => { select(view?.listings.find(x => x.selection.listing_id === switchTo) ?? null); setSwitchTo(null); selectRef.current?.focus(); }}>{t.switch}</button>
    </div>}
  </section>;
}
