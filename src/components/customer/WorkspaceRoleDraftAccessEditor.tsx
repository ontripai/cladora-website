'use client';

import { useState } from 'react';
import type { Language } from '@/types';
import type {
  GetWorkspaceRolesResponse,
  WorkspaceRoleItem,
} from '@/lib/customer/workspace-roles-schema';

type Props = {
  contextId: string;
  role: WorkspaceRoleItem;
  modules: GetWorkspaceRolesResponse['available_modules'];
  permissions: GetWorkspaceRolesResponse['available_permissions'];
  lang: Language;
  onChanged: () => void;
  onMfaRequired: () => void;
};

function idempotencyKey(prefix: string, roleId: string) {
  return `${prefix}_${roleId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function WorkspaceRoleDraftAccessEditor({ contextId, role, modules, permissions, lang, onChanged, onMfaRequired }: Props) {
  const [moduleId, setModuleId] = useState('');
  const [permissionId, setPermissionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isFa = lang === 'fa';
  const isRo = lang === 'ro';

  const attach = async (kind: 'module' | 'permission') => {
    const selectedId = kind === 'module' ? moduleId : permissionId;
    if (!selectedId || busy) return;
    const reason = prompt(
      kind === 'module'
        ? isFa ? 'دلیل ممیزی افزودن ماژول را وارد کنید:' : isRo ? 'Introduceți motivul auditului pentru atașarea modulului:' : 'Enter an audit reason for attaching this module:'
        : isFa ? 'دلیل ممیزی افزودن مجوز را وارد کنید:' : isRo ? 'Introduceți motivul auditului pentru atașarea permisiunii:' : 'Enter an audit reason for attaching this permission:'
    );
    if (!reason || reason.trim().length < 5) return;

    setBusy(true);
    setMessage('');
    try {
      const endpoint = kind === 'module'
        ? '/api/customer/v1/workspace/roles/modules/attach'
        : '/api/customer/v1/workspace/roles/permissions/attach';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          workspace_role_id: role.id,
          ...(kind === 'module' ? { module_definition_id: selectedId } : { permission_id: selectedId, effect: 'allow' }),
          expected_lock_version: role.lock_version,
          reason: reason.trim(),
          idempotency_key: idempotencyKey(kind, role.id),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        const error = result?.error?.message || (isFa ? 'ثبت دسترسی ناموفق بود.' : isRo ? 'Adăugarea accesului a eșuat.' : 'Could not attach access.');
        if (result?.error?.code === 'MFA_REQUIRED') onMfaRequired();
        setMessage(result?.error?.code === 'MFA_REQUIRED' ? `${error} ${isFa ? 'تأیید MFA لازم است.' : 'AAL2 verification is required.'}` : error);
        return;
      }
      setMessage(isFa ? 'تغییر در پیش‌نویس ثبت شد.' : isRo ? 'Modificarea a fost salvată în ciornă.' : 'Draft updated.');
      if (kind === 'module') setModuleId('');
      else setPermissionId('');
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const remainingModules = modules.filter((item) => !role.modules.some((attached) => attached.id === item.id));
  const remainingPermissions = permissions.filter((item) =>
    role.modules.some((module) => module.code === item.module_code) &&
    !role.permissions.some((attached) => attached.id === item.id)
  );

  return (
    <section className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {isFa ? 'تنظیم دسترسی‌های پیش‌نویس' : isRo ? 'Configurare acces ciornă' : 'Configure draft access'}
      </h4>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={isFa ? 'انتخاب ماژول' : isRo ? 'Selectează modul' : 'Select module'}
          value={moduleId}
          onChange={(event) => setModuleId(event.target.value)}
          disabled={busy || remainingModules.length === 0}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">{isFa ? 'ماژول فعال را انتخاب کنید' : isRo ? 'Selectați un modul activ' : 'Select an active module'}</option>
          {remainingModules.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
        <button type="button" onClick={() => void attach('module')} disabled={busy || !moduleId} className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-800 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-200">
          {isFa ? 'افزودن ماژول' : isRo ? 'Atașați modulul' : 'Attach module'}
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={isFa ? 'انتخاب مجوز' : isRo ? 'Selectează permisiunea' : 'Select permission'}
          value={permissionId}
          onChange={(event) => setPermissionId(event.target.value)}
          disabled={busy || remainingPermissions.length === 0}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">{isFa ? 'مجوز ماژول متصل را انتخاب کنید' : isRo ? 'Selectați o permisiune din modulele atașate' : 'Select a permission from attached modules'}</option>
          {remainingPermissions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.permission_mode}{item.requires_aal2 ? ' · AAL2' : ''}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void attach('permission')} disabled={busy || !permissionId} className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-800 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-200">
          {isFa ? 'افزودن مجوز' : isRo ? 'Atașați permisiunea' : 'Attach permission'}
        </button>
      </div>
      {message && <p role="status" aria-live="polite" className="text-xs text-gray-700 dark:text-gray-300">{message}</p>}
    </section>
  );
}
