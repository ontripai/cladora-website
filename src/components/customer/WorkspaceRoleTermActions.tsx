'use client';

import { useState } from 'react';
import type { Language } from '@/types';
import type { WorkspaceMemberRoleAssignmentItem } from '@/lib/customer/workspace-roles-schema';

type Member = { membership_id: string; member_name: string | null; role_code: string };
type Mode = 'handover' | 'renew';

export function WorkspaceRoleTermActions({ assignment, contextId, authorityContextId, lang, onChanged, onMfaRequired }: {
  assignment: WorkspaceMemberRoleAssignmentItem;
  contextId: string;
  authorityContextId: string | null;
  lang: Language;
  onChanged: () => void;
  onMfaRequired: () => void;
}) {
  const t = (en: string, ro: string, fa: string) => lang === 'fa' ? fa : lang === 'ro' ? ro : en;
  const [mode, setMode] = useState<Mode | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [targetId, setTargetId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ endpoint: string; body: Record<string, unknown> } | null>(null);
  const enabled = assignment.scope_type !== 'workspace' || !!authorityContextId;

  const open = async (nextMode: Mode) => {
    setMode(nextMode); setError(''); setTargetId(''); setReason(''); setExpiry(''); setPending(null);
    if (nextMode !== 'handover') return;
    setBusy(true);
    try {
      const response = await fetch(`/api/customer/v1/workspace/roles/assignment-candidates?context_id=${encodeURIComponent(contextId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.members)) throw new Error('candidates');
      setMembers(body.members.filter((member: Member) => member.membership_id !== assignment.membership_id));
    } catch {
      setError(t('Could not load eligible members.', 'Nu s-au putut încărca membrii eligibili.', 'اعضای مجاز بارگذاری نشدند.'));
    } finally { setBusy(false); }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode || busy) return;
    let request = pending;
    if (!request) {
      const timestamp = expiry ? Date.parse(expiry) : null;
      if (timestamp !== null && !Number.isFinite(timestamp)) {
        setError(t('Choose a valid expiry.', 'Alegeți o dată validă.', 'تاریخ پایان معتبر انتخاب کنید.'));
        return;
      }
      const end = timestamp === null ? null : new Date(timestamp).toISOString();
      if (mode === 'renew' && (!end || (assignment.valid_to && Date.parse(end) <= Date.parse(assignment.valid_to)))) {
        setError(t('Choose an expiry later than the current one.', 'Alegeți o expirare ulterioară celei actuale.', 'تاریخ پایان را پس از اعتبار فعلی انتخاب کنید.'));
        return;
      }
      if (mode === 'handover' && end && assignment.valid_to && Date.parse(end) > Date.parse(assignment.valid_to)) {
        setError(t('The handover cannot outlast the current role.', 'Transferul nu poate depăși durata rolului actual.', 'مدت تحویل نمی‌تواند از نقش فعلی بیشتر باشد.'));
        return;
      }
      request = {
        endpoint: mode === 'handover' ? 'handover' : 'renew-assignment',
        body: {
          context_id: contextId,
          ...(assignment.scope_type === 'workspace' ? { authority_context_id: authorityContextId } : {}),
          assignment_id: assignment.id,
          expected_lock_version: assignment.lock_version,
          ...(mode === 'handover' ? { successor_membership_id: targetId } : {}),
          valid_until: end,
          reason: reason.trim(),
          idempotency_key: `role_${crypto.randomUUID()}`,
        },
      };
      setPending(request);
    }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/customer/v1/workspace/roles/${request.endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body?.error?.code === 'MFA_REQUIRED') onMfaRequired();
        if (response.status < 500) setPending(null);
        throw new Error('command');
      }
      if (body?.action !== (mode === 'handover' ? 'handover_role' : 'renew_role')) throw new Error('result');
      setPending(null); setMode(null); onChanged();
    } catch {
      setError(t('Request not confirmed. Retry with the same key.', 'Cererea nu este confirmată. Reîncercați cu aceeași cheie.', 'درخواست تأیید نشد. با همان کلید دوباره تلاش کنید.'));
    } finally { setBusy(false); }
  };

  return <>
    <button type="button" disabled={!enabled || busy} onClick={() => void open('handover')}
      className="text-xs font-medium text-indigo-600 disabled:opacity-50">
      {t('Handover', 'Transferă', 'تحویل مسئولیت')}
    </button>
    {' · '}
    <button type="button" disabled={!enabled || !assignment.valid_to || busy} onClick={() => void open('renew')}
      className="text-xs font-medium text-indigo-600 disabled:opacity-50">
      {t('Extend', 'Prelungește', 'تمدید')}
    </button>
    {mode && <div role="dialog" aria-modal="true" aria-label={mode === 'handover' ? t('Handover role', 'Transferă rolul', 'تحویل نقش') : t('Extend role', 'Prelungește rolul', 'تمدید نقش')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 text-start shadow-xl dark:bg-gray-900">
        <h3 className="font-semibold">{mode === 'handover' ? t('Handover responsibility', 'Transferă responsabilitatea', 'تحویل مسئولیت') : t('Extend assignment', 'Prelungește atribuirea', 'تمدید تخصیص')}</h3>
        {mode === 'handover' && <label className="block text-sm">{t('Successor', 'Succesor', 'جانشین')}
          <select required disabled={busy || !!pending} value={targetId} onChange={event => setTargetId(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900">
            <option value="">{t('Select member', 'Selectați membrul', 'انتخاب عضو')}</option>
            {members.map(member => <option key={member.membership_id} value={member.membership_id}>{member.member_name || member.membership_id} · {member.role_code}</option>)}
          </select>
        </label>}
        <label className="block text-sm">{t('New expiry', 'Noua expirare', 'تاریخ پایان جدید')}
          <input type="datetime-local" required={mode === 'renew'} disabled={busy || !!pending} value={expiry} onChange={event => setExpiry(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900" />
        </label>
        <label className="block text-sm">{t('Reason', 'Motiv', 'دلیل')}
          <input required minLength={5} maxLength={500} disabled={busy || !!pending} value={reason} onChange={event => setReason(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900" />
        </label>
        <p className="text-xs text-gray-500">{t('Earlier actions keep their original author. New actions belong to the successor.', 'Acțiunile vechi își păstrează autorul. Acțiunile noi aparțin succesorului.', 'اقدامات قبلی به نام عامل قبلی می‌مانند و اقدامات جدید به نام جانشین ثبت می‌شوند.')}</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy || (mode === 'handover' && !targetId) || reason.trim().length < 5} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending ? t('Retry', 'Reîncearcă', 'تلاش دوباره') : t('Confirm', 'Confirmă', 'تأیید')}
          </button>
          <button type="button" disabled={busy || !!pending} onClick={() => setMode(null)} className="rounded border px-4 py-2 text-sm disabled:opacity-50">{t('Cancel', 'Anulează', 'انصراف')}</button>
        </div>
      </form>
    </div>}
  </>;
}
