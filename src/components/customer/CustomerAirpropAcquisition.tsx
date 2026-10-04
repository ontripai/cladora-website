'use client';

import { useEffect, useRef, useState } from 'react';
import { acquisitionCommandV1Schema, acquisitionDetailV1Schema, acquisitionResponseV1Schema } from '@/lib/airprop/acquisition-decision-v1';
import type { z } from 'zod';

type Language = 'en' | 'ro' | 'fa';
type Command = z.infer<typeof acquisitionCommandV1Schema>;
type Detail = z.infer<typeof acquisitionDetailV1Schema>;
type Props = { contextId: string; workspaceId: string; opportunityId: string; diligenceCaseId: string; documentContextId: string; lang: Language; refreshToken: number };
const copy = {
  en: { title: 'Internal acquisition decision', boundary: 'Two independent reviewers must approve the exact submitted diligence and evaluation. This records an internal decision; agreement, signature, payment and title transfer require separate steps.', prerequisite: 'Complete and submit diligence first.', stale: 'The evaluation or evidence changed. A new current baseline is required.', noAccess: 'Your current access permits viewing only. Preparing the evaluation or diligence also prevents reviewing this proposal.', context: 'Choose an authorized document context and refresh.', loading: 'Loading…', refresh: 'Refresh decision', rationale: 'Proposal rationale', propose: 'Record proposal', voteRationale: 'Review rationale', decision: 'Your decision', choose: 'Choose explicitly…', approve: 'Approve internally', reject: 'Reject', save: 'Record independent decision', pending: 'Awaiting independent decisions', rejected: 'Rejected', internally_approved: 'Internally approved', count: 'Independent approvals', revision: 'Decision revision', expires: 'Decision deadline', expired: 'The proposal expired. No new decision can be recorded.', retry: 'Retry the same request', uncertain: 'The result is uncertain. Retry the same request before making another change.', invalid: 'Check the rationale and explicit decision.', conflict: 'The version or state changed. The current decision has been reloaded.', denied: 'This action requires current access and an independent reviewer.', mfa: 'Complete multi-factor authentication.', storage: 'Request recovery is unavailable. Reload and check browser storage.', success: 'Recorded.', error: 'The decision could not be loaded. Check document access and refresh.' },
  ro: { title: 'Decizie internă de achiziție', boundary: 'Doi evaluatori independenți trebuie să aprobe verificarea și evaluarea exactă trimisă. Se înregistrează o decizie internă; contractul, semnătura, plata și transferul proprietății necesită pași separați.', prerequisite: 'Finalizați și trimiteți mai întâi verificarea.', stale: 'Evaluarea sau dovezile s-au schimbat. Este necesară o bază actuală nouă.', noAccess: 'Accesul actual permite doar vizualizarea. Autorii evaluării sau verificării nu pot evalua această propunere.', context: 'Selectați un context autorizat pentru documente și reîmprospătați.', loading: 'Se încarcă…', refresh: 'Reîmprospătează decizia', rationale: 'Motivarea propunerii', propose: 'Înregistrează propunerea', voteRationale: 'Motivarea evaluării', decision: 'Decizia dumneavoastră', choose: 'Selectați explicit…', approve: 'Aprobă intern', reject: 'Respinge', save: 'Înregistrează decizia independentă', pending: 'În așteptarea deciziilor independente', rejected: 'Respinsă', internally_approved: 'Aprobată intern', count: 'Aprobări independente', revision: 'Versiunea deciziei', expires: 'Termenul deciziei', expired: 'Propunerea a expirat. Nu se mai poate înregistra o decizie.', retry: 'Reîncearcă aceeași cerere', uncertain: 'Rezultatul este incert. Reîncercați aceeași cerere înainte de altă modificare.', invalid: 'Verificați motivarea și decizia explicită.', conflict: 'Versiunea sau starea s-a schimbat. Decizia actuală a fost reîncărcată.', denied: 'Acțiunea necesită acces actual și un evaluator independent.', mfa: 'Finalizați autentificarea multifactor.', storage: 'Recuperarea cererii nu este disponibilă. Reîncărcați și verificați stocarea browserului.', success: 'Înregistrat.', error: 'Decizia nu a putut fi încărcată. Verificați accesul la documente și reîmprospătați.' },
  fa: { title: 'تصمیم داخلی خرید', boundary: 'دو بررسی‌کنندهٔ مستقل باید نسخهٔ دقیق بررسی موشکافانه و ارزیابی ارسال‌شده را تأیید کنند. این مرحله تصمیم داخلی را ثبت می‌کند؛ قرارداد، امضا، پرداخت و انتقال مالکیت مراحل جداگانه‌اند.', prerequisite: 'ابتدا بررسی موشکافانه را تکمیل و ارسال کنید.', stale: 'ارزیابی یا مدارک تغییر کرده است. مبنای جدید و به‌روز لازم است.', noAccess: 'دسترسی فعلی فقط مشاهده را مجاز می‌کند. تهیه‌کنندگان ارزیابی یا بررسی نیز نمی‌توانند این پیشنهاد را تأیید کنند.', context: 'زمینهٔ مجاز مدارک را انتخاب و تازه‌سازی کنید.', loading: 'در حال دریافت…', refresh: 'تازه‌سازی تصمیم', rationale: 'دلیل پیشنهاد', propose: 'ثبت پیشنهاد', voteRationale: 'دلیل تصمیم', decision: 'تصمیم شما', choose: 'صریحاً انتخاب کنید…', approve: 'تأیید داخلی', reject: 'رد', save: 'ثبت تصمیم مستقل', pending: 'در انتظار تصمیم‌های مستقل', rejected: 'ردشده', internally_approved: 'تأیید داخلی تکمیل شده', count: 'تأییدهای مستقل', revision: 'نسخهٔ تصمیم', expires: 'مهلت تصمیم', expired: 'پیشنهاد منقضی شده است. تصمیم جدید قابل ثبت نیست.', retry: 'تکرار همان درخواست', uncertain: 'نتیجه مشخص نیست. پیش از تغییر دیگر، همان درخواست را تکرار کنید.', invalid: 'دلیل و انتخاب صریح تصمیم را بررسی کنید.', conflict: 'نسخه یا وضعیت تغییر کرده است. تصمیم فعلی دوباره دریافت شد.', denied: 'این اقدام به دسترسی فعال و بررسی‌کنندهٔ مستقل نیاز دارد.', mfa: 'احراز هویت چندمرحله‌ای را تکمیل کنید.', storage: 'بازیابی درخواست ممکن نیست. صفحه و ذخیره‌سازی مرورگر را بررسی کنید.', success: 'ثبت شد.', error: 'تصمیم دریافت نشد. دسترسی به مدارک را بررسی و تازه‌سازی کنید.' },
};
export function CustomerAirpropAcquisition(props: Props) {
  return <Acquisition key={`${props.contextId}:${props.workspaceId}:${props.opportunityId}:${props.diligenceCaseId}:${props.documentContextId}`} {...props} />;
}
function Acquisition({ contextId, workspaceId, opportunityId, diligenceCaseId, documentContextId, lang, refreshToken }: Props) {
  const t = copy[lang];
  const [loadedDetail, setDetail] = useState<Detail | null>(null), [loadedKey, setLoadedKey] = useState(''), [failed, setFailed] = useState(false), [nonce, setNonce] = useState(0);
  const [rationale, setRationale] = useState(''), [decision, setDecision] = useState<'' | 'approve' | 'reject'>('');
  const [busy, setBusy] = useState(false), [recovering, setRecovering] = useState(true), [blocked, setBlocked] = useState(false), [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<keyof typeof t | null>(null);
  const epoch = useRef(0), pending = useRef<Command | null>(null), inflight = useRef(false);
  const storageKey = `cladora.airprop.acquisition.pending.v1:${contextId}:${workspaceId}:${opportunityId}:${diligenceCaseId}:${documentContextId}`;
  const query = new URLSearchParams({ context_id: contextId, workspace_id: workspaceId, opportunity_id: opportunityId, diligence_case_id: diligenceCaseId, ...(documentContextId ? { document_context_id: documentContextId } : {}) }).toString();
  useEffect(() => {
    const generation = ++epoch.current;
    Promise.resolve().then(() => {
      if (generation !== epoch.current) return;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const command = acquisitionCommandV1Schema.parse(JSON.parse(stored));
          if (command.context_id !== contextId || command.workspace_id !== workspaceId || command.opportunity_id !== opportunityId || command.diligence_case_id !== diligenceCaseId || command.document_context_id !== documentContextId) throw new Error();
          pending.current = command; setUncertain(true); setMessage('uncertain');
        }
      } catch { setBlocked(true); setMessage('storage'); }
      setRecovering(false);
    });
    return () => { epoch.current = generation + 1; };
  }, [storageKey, contextId, workspaceId, opportunityId, diligenceCaseId, documentContextId]);
  const loadKey = `${query}:${nonce}:${refreshToken}`;
  const detail = loadedKey === loadKey ? loadedDetail : null;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/customer/v2/airprop/acquisition?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const body = acquisitionDetailV1Schema.parse(await response.json());
      if (body.workspace_id !== workspaceId || body.opportunity_id !== opportunityId || body.diligence_case_id !== diligenceCaseId) throw new Error();
      if (!controller.signal.aborted) { setDetail(body); setLoadedKey(loadKey); setFailed(false); }
    }).catch(() => { if (!controller.signal.aborted) { setDetail(null); setFailed(true); } });
    return () => controller.abort();
  }, [query, workspaceId, opportunityId, diligenceCaseId, nonce, refreshToken, loadKey]);
  function refresh() { setDetail(null); setRationale(''); setDecision(''); setNonce(value => value + 1); }
  async function send(input: Command) {
    if (inflight.current || blocked || recovering) return;
    const command = pending.current ?? input;
    try { sessionStorage.setItem(storageKey, JSON.stringify(command)); } catch { setBlocked(true); setMessage('storage'); return; }
    pending.current = command; inflight.current = true; setBusy(true); setMessage(null);
    const generation = epoch.current;
    try {
      const response = await fetch('/api/customer/v2/airprop/acquisition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) });
      const body = await response.json();
      if (generation !== epoch.current) return;
      if (response.ok) {
        const result = acquisitionResponseV1Schema.parse(body);
        const expectedRevision = command.action === 'propose' ? 1 : command.expected_decision_revision + 1;
        const expectedStatus = command.action === 'propose' || (command.decision === 'approve' && expectedRevision === 2) ? 'pending' : command.decision === 'reject' ? 'rejected' : 'internally_approved';
        if (result.workspace_id !== workspaceId || result.opportunity_id !== opportunityId || result.diligence_case_id !== diligenceCaseId || result.decision_revision !== expectedRevision || result.status !== expectedStatus || (command.action === 'decide' && result.proposal_id !== command.proposal_id)) throw new Error();
        sessionStorage.removeItem(storageKey); pending.current = null; setUncertain(false); setMessage('success'); refresh();
      } else if (response.status === 409 || response.status === 400) {
        sessionStorage.removeItem(storageKey); pending.current = null; setUncertain(false); setMessage(response.status === 409 ? 'conflict' : 'invalid');
        if (response.status === 409) refresh();
      } else { setUncertain(true); setMessage(body.error?.code === 'MFA_REQUIRED' ? 'mfa' : response.status === 401 || response.status === 403 ? 'denied' : 'uncertain'); }
    } catch { if (generation === epoch.current) { setUncertain(true); setMessage('uncertain'); } }
    finally { inflight.current = false; if (generation === epoch.current) setBusy(false); }
  }
  function command(action: 'propose' | 'decide') {
    if (!detail) return;
    const parsed = acquisitionCommandV1Schema.safeParse({ version: 1, context_id: contextId, workspace_id: workspaceId, opportunity_id: opportunityId, diligence_case_id: diligenceCaseId, document_context_id: documentContextId, rationale, idempotency_key: crypto.randomUUID(), action,
      ...(action === 'propose' ? { expected_submission_id: detail.submission_id, expected_diligence_revision: detail.diligence_revision, expected_underwriting_version: detail.underwriting_version }
        : { proposal_id: detail.proposal?.proposal_id, expected_decision_revision: detail.proposal?.decision_revision, decision }) });
    if (!parsed.success) { setMessage('invalid'); return; }
    void send(parsed.data);
  }
  const disabled = busy || recovering || blocked || uncertain || !documentContextId || !detail;
  return <section aria-label={t.title} className="space-y-3 rounded border p-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
    <h3 className="text-lg font-semibold">{t.title}</h3><p>{t.boundary}</p>
    <button type="button" disabled={busy || uncertain} className="rounded border px-3 py-2" onClick={refresh}>{t.refresh}</button>
    {failed ? <p role="alert">{t.error}</p> : !detail ? <p role="status">{t.loading}</p> : <>
      {detail.reason === 'DILIGENCE_NOT_SUBMITTED' ? <p>{t.prerequisite}</p> : !detail.eligible ? <p role="alert">{t.stale}</p> : null}
      {!documentContextId && <p>{t.context}</p>}
      {detail.proposal && <div className="space-y-2"><p className="font-semibold">{t[detail.proposal.status]} · {t.count}: {detail.proposal.approval_count}/2 · {t.revision}: {detail.proposal.decision_revision}</p>
        <p className="whitespace-pre-wrap">{detail.proposal.rationale}</p><p>{t.expires}: <time dateTime={detail.proposal.expires_at}>{detail.proposal.expires_at}</time></p>
        {detail.proposal.expired && <p role="alert">{t.expired}</p>}
        <ol className="space-y-2">{detail.proposal.decisions.map(vote => <li key={vote.decision_revision} className="rounded border p-2"><p>{t.revision} {vote.decision_revision}: {vote.decision === 'approve' ? t.approve : t.reject}</p><p className="whitespace-pre-wrap">{vote.rationale}</p><time dateTime={vote.decided_at}>{vote.decided_at}</time></li>)}</ol>
      </div>}
      {(detail.can_propose || detail.can_decide) ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!disabled) command(detail.can_propose ? 'propose' : 'decide'); }}>
        <fieldset disabled={disabled} className="space-y-3"><label className="block">{detail.can_propose ? t.rationale : t.voteRationale}<textarea required maxLength={2000} className="block w-full rounded border p-2" value={rationale} onChange={event => setRationale(event.target.value)} /></label>
          {detail.can_decide && <label className="block">{t.decision}<select required className="block w-full rounded border p-2" value={decision} onChange={event => setDecision(event.target.value as typeof decision)}><option value="">{t.choose}</option><option value="approve">{t.approve}</option><option value="reject">{t.reject}</option></select></label>}
        </fieldset><button disabled={disabled || !rationale.trim() || (detail.can_decide && !decision)} className="rounded bg-slate-900 px-4 py-2 text-white disabled:bg-slate-400">{detail.can_propose ? t.propose : t.save}</button>
      </form> : detail.eligible && (!detail.proposal || detail.proposal.status === 'pending') ? <p>{t.noAccess}</p> : null}
    </>}
    {uncertain && <button type="button" disabled={busy || blocked || recovering} className="rounded bg-slate-900 px-4 py-2 text-white" onClick={() => pending.current && void send(pending.current)}>{t.retry}</button>}
    <p role="status" aria-live="polite">{message ? t[message] : ''}</p>
  </section>;
}
