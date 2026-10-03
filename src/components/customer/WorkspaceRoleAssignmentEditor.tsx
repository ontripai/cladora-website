'use client';

import { useEffect, useState } from 'react';
import type { Language } from '@/types';
import { assignWorkspaceRoleRequestSchema, uuidSchema, type WorkspaceRoleItem } from '@/lib/customer/workspace-roles-schema';

type Member = { membership_id: string; member_name: string | null; role_code: string };
type Command = ReturnType<typeof assignWorkspaceRoleRequestSchema.parse>;

export function WorkspaceRoleAssignmentEditor({ lang, contextId, workspaceId, roles, onChanged, onMfaRequired }: {
  lang: Language; contextId: string; workspaceId: string; roles: WorkspaceRoleItem[];
  onChanged: () => void; onMfaRequired: () => void;
}) {
  const text = (en: string, ro: string, fa: string) => lang === 'fa' ? fa : lang === 'ro' ? ro : en;
  const storageKey = `cladora.roles.assignment.v1:${contextId}:${workspaceId}`;
  const [shownAt] = useState(() => Date.now());
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [reason, setReason] = useState('');
  const [expires, setExpires] = useState('');
  const [pending, setPending] = useState<Command | null>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    void (async () => {
    await Promise.resolve();
    if (!current) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = assignWorkspaceRoleRequestSchema.safeParse(JSON.parse(saved));
        if (parsed.success && parsed.data.context_id === contextId && parsed.data.scope_type === 'workspace'
          && !parsed.data.property_id && !parsed.data.building_id && !parsed.data.unit_id) {
          setPending(parsed.data); setMemberId(parsed.data.target_membership_id);
          setRoleId(parsed.data.workspace_role_id); setReason(parsed.data.reason);
        } else { setRecoveryBlocked(true); setMessage('Saved request could not be recovered.'); }
      }
    } catch { setRecoveryBlocked(true); setMessage('Saved request could not be recovered.'); }
      try {
        const res = await fetch(`/api/customer/v1/workspace/roles/assignment-candidates?context_id=${contextId}`, { cache: 'no-store', signal: controller.signal });
        const result = await res.json();
        if (!current) return;
        if (!res.ok) {
          if (result?.error?.code === 'MFA_REQUIRED') onMfaRequired();
          throw new Error('Assignment access denied');
        }
        if (result.workspace_id !== workspaceId || !Array.isArray(result.members)
          || result.members.some((item: Member) => !uuidSchema.safeParse(item.membership_id).success || typeof item.role_code !== 'string')) {
          throw new Error('Invalid member response');
        }
        setMembers(result.members);
      } catch { if (current) setMessage(lang === 'fa' ? 'بارگذاری اعضای مجاز انجام نشد.' : lang === 'ro' ? 'Membrii autorizați nu au putut fi încărcați.' : 'Could not load authorized members.'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; controller.abort(); };
  }, [contextId, workspaceId, storageKey, lang, onMfaRequired]);

  const availableRoles = roles.filter(role => role.lifecycle_status === 'published' && role.scope_ceiling === 'workspace'
    && Date.parse(role.valid_from) <= shownAt && (!role.valid_to || Date.parse(role.valid_to) > shownAt));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || recoveryBlocked) return;
    const retrying = pending !== null;
    setBusy(true); setMessage('');
    try {
      const command = pending ?? assignWorkspaceRoleRequestSchema.parse({ context_id: contextId,
        target_membership_id: memberId, workspace_role_id: roleId, scope_type: 'workspace',
        valid_until: expires ? new Date(expires).toISOString() : null, reason,
        idempotency_key: `assign_${crypto.randomUUID()}` });
      // Persist exact command before sending. Uncertain outcomes keep the same key.
      sessionStorage.setItem(storageKey, JSON.stringify(command)); setPending(command);
      const res = await fetch('/api/customer/v1/workspace/roles/assign', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      const result = await res.json();
      if (!res.ok) {
        if (result?.error?.code === 'MFA_REQUIRED') onMfaRequired();
        if (!retrying && res.status >= 400 && res.status < 500) { sessionStorage.removeItem(storageKey); setPending(null); }
        throw new Error('Assignment request failed');
      }
      if (result.action !== 'assign_role' || !uuidSchema.safeParse(result.id).success
        || result.membership_id !== command.target_membership_id || result.workspace_role_id !== command.workspace_role_id
        || result.scope_type !== 'workspace') throw new Error('Unconfirmed assignment');
      sessionStorage.removeItem(storageKey); setPending(null); setMemberId(''); setRoleId(''); setReason(''); setExpires('');
      setMessage(text('Role assigned.', 'Rol atribuit.', 'نقش تخصیص داده شد.')); onChanged();
    } catch {
      setMessage(text('Request not confirmed. Retry the saved request if available.', 'Cerere neconfirmată. Reîncercați cererea salvată, dacă există.', 'درخواست تأیید نشد. در صورت وجود درخواست ذخیره‌شده، همان را دوباره ارسال کنید.'));
    } finally { setBusy(false); }
  };

  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-indigo-200 p-4 dark:border-indigo-800">
    <h3 className="font-semibold">{text('Assign a workspace role', 'Atribuie un rol workspace', 'تخصیص نقش ورک‌اسپیس')}</h3>
    <p className="text-sm text-gray-500">{text('Select an active member and a published role. Access remains limited to this workspace.', 'Selectați un membru activ și un rol publicat. Accesul este limitat la acest workspace.', 'عضو فعال و نقش منتشرشده را انتخاب کنید. دسترسی به همین ورک‌اسپیس محدود می‌ماند.')}</p>
    <fieldset disabled={busy || recoveryBlocked || pending !== null || loading} className="grid gap-3 sm:grid-cols-2">
      <label>{text('Member', 'Membru', 'عضو')}
        <select required value={memberId} onChange={event => setMemberId(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900">
          <option value="">{text('Select member', 'Selectați membrul', 'انتخاب عضو')}</option>
          {members.map(member => <option key={member.membership_id} value={member.membership_id}>{member.member_name || member.membership_id} · {member.role_code}</option>)}
        </select>
      </label>
      <label>{text('Published role', 'Rol publicat', 'نقش منتشرشده')}
        <select required value={roleId} onChange={event => setRoleId(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900">
          <option value="">{text('Select role', 'Selectați rolul', 'انتخاب نقش')}</option>
          {availableRoles.map(role => <option key={role.id} value={role.id}>{role.name} · v{role.role_version}</option>)}
        </select>
      </label>
      <label>{text('Expiry (optional)', 'Expirare (opțional)', 'انقضا (اختیاری)')}
        <input type="datetime-local" value={expires} onChange={event => setExpires(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900" />
      </label>
      <label>{text('Audit reason', 'Motiv audit', 'دلیل تخصیص')}
        <input required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="block w-full rounded border p-2 dark:bg-gray-900" />
      </label>
    </fieldset>
    {pending && <p role="status">{text('A saved request is awaiting confirmation. Retry uses the same member, role and key.', 'O cerere salvată așteaptă confirmarea. Reîncercarea folosește același membru, rol și cheie.', 'درخواست ذخیره‌شده منتظر تأیید است. تکرار با همان عضو، نقش و کلید انجام می‌شود.')}</p>}
    <button type="submit" disabled={busy || recoveryBlocked || (!pending && (loading || !memberId || !roleId || reason.trim().length < 5))} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{pending ? text('Retry saved request', 'Reîncearcă cererea salvată', 'تکرار درخواست ذخیره‌شده') : text('Assign role', 'Atribuie rolul', 'تخصیص نقش')}</button>
    {!loading && !availableRoles.length && <p>{text('Publish a role with workspace scope first.', 'Publicați mai întâi un rol cu domeniul workspace.', 'ابتدا نقشی با محدودهٔ ورک‌اسپیس منتشر کنید.')}</p>}
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}
