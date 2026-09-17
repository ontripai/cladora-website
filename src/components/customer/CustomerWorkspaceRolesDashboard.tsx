'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Plus,
  RefreshCw,
  Lock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { Language } from '@/types';
import { isRtlLocale } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';
import type {
  GetWorkspaceRolesResponse,
  WorkspaceRoleItem,
  WorkspaceMemberRoleAssignmentItem,
} from '@/lib/customer/workspace-roles-schema';

function makeIdempotencyKey(prefix: string, id: string): string {
  const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${cleanId || 'new'}_${rand}`;
}

export function CustomerWorkspaceRolesDashboard({ lang }: { lang: Language }) {
  const isRtl = isRtlLocale(lang);
  const state = useCustomerContext();
  const contextId = state.active?.context_id;

  const [data, setData] = useState<GetWorkspaceRolesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments'>('roles');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Draft Form
  const [draftCode, setDraftCode] = useState<string>('');
  const [draftName, setDraftName] = useState<string>('');
  const [draftDesc, setDraftDesc] = useState<string>('');
  const [draftCeiling, setDraftCeiling] = useState<'workspace' | 'property' | 'building' | 'unit'>('workspace');
  const [draftBaseRoleId, setDraftBaseRoleId] = useState<string>('');
  const [draftReason, setDraftReason] = useState<string>('');

  const fetchRoles = useCallback(async () => {
    if (!contextId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMfaRequired(false);
    try {
      const res = await fetch(`/api/customer/v1/workspace/roles?context_id=${contextId}`, {
        cache: 'no-store',
      });
      if (res.status === 403) {
        setError('Forbidden: workspace.role.read permission required');
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load workspace roles');
      }
      const json: GetWorkspaceRolesResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading roles');
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRoles();
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const key = makeIdempotencyKey('create', draftCode);
      const res = await fetch('/api/customer/v1/workspace/roles/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          code: draftCode,
          name: draftName,
          description: draftDesc || null,
          scope_ceiling: draftCeiling,
          base_role_id: draftBaseRoleId || null,
          reason: draftReason,
          idempotency_key: key,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        if (resJson?.error?.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          return;
        }
        throw new Error(resJson?.error?.message || 'Failed to create draft role');
      }
      setIsCreateModalOpen(false);
      setDraftCode('');
      setDraftName('');
      setDraftDesc('');
      setDraftReason('');
      void fetchRoles();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishRole = async (role: WorkspaceRoleItem) => {
    if (!contextId) return;
    const reason = prompt('Please provide an audit reason for publishing this role:');
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required.');
      return;
    }
    setActionLoading(true);
    try {
      const key = makeIdempotencyKey('publish', role.id);
      const res = await fetch('/api/customer/v1/workspace/roles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          workspace_role_id: role.id,
          expected_lock_version: role.lock_version,
          reason: reason.trim(),
          idempotency_key: key,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        if (resJson?.error?.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          return;
        }
        alert(resJson?.error?.message || 'Failed to publish role');
        return;
      }
      void fetchRoles();
    } catch (err: any) {
      alert(err.message || 'Error publishing role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSnapshotTemplate = async (role: WorkspaceRoleItem) => {
    if (!contextId) return;
    const reason = prompt('Please provide a reason for snapshotting template permissions:');
    if (!reason || reason.trim().length < 5) return;
    setActionLoading(true);
    try {
      const key = makeIdempotencyKey('snapshot', role.id);
      const res = await fetch('/api/customer/v1/workspace/roles/snapshot-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          workspace_role_id: role.id,
          expected_lock_version: role.lock_version,
          reason: reason.trim(),
          idempotency_key: key,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        if (resJson?.error?.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          return;
        }
        alert(resJson?.error?.message || 'Failed to copy template permissions');
        return;
      }
      void fetchRoles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAssignment = async (assignment: WorkspaceMemberRoleAssignmentItem) => {
    if (!contextId) return;
    const reason = prompt('Please provide a reason for revoking this role assignment:');
    if (!reason || reason.trim().length < 5) return;
    setActionLoading(true);
    try {
      const key = makeIdempotencyKey('revoke', assignment.id);
      const res = await fetch('/api/customer/v1/workspace/roles/revoke-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          assignment_id: assignment.id,
          expected_lock_version: assignment.lock_version,
          reason: reason.trim(),
          idempotency_key: key,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        if (resJson?.error?.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          return;
        }
        alert(resJson?.error?.message || 'Failed to revoke assignment');
        return;
      }
      void fetchRoles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {lang === 'fa'
                ? 'نقش‌ها و دسترسی‌های محیط کاری'
                : lang === 'ro'
                ? 'Roluri și Permisiuni Workspace'
                : 'Workspace Roles & Permissions'}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'fa'
              ? 'مدیریت نقش‌های محلی محیط کاری، حوزه‌های دسترسی ماژول‌ها و تخصیص نقش به اعضا.'
              : lang === 'ro'
              ? 'Gestionează rolurile locale din workspace, domeniile de acces la module și atribuirile membrilor.'
              : 'Manage workspace-local roles, module access scopes, and member assignments.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchRoles()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'fa' ? 'به‌روزرسانی' : lang === 'ro' ? 'Reîmprospătează' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'fa' ? 'ایجاد پیش‌نویس نقش' : lang === 'ro' ? 'Creează Ciornă Rol' : 'Create Role Draft'}</span>
          </button>
        </div>
      </div>

      {/* MFA Banner if needed */}
      {mfaRequired && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              {lang === 'fa'
                ? 'این عملیات نیازمند احراز هویت دومرحله‌ای معتبر (AAL2) است.'
                : lang === 'ro'
                ? 'Această acțiune necesită Autentificare cu Factor Multiplu (AAL2).'
                : 'This action requires Multi-Factor Authentication (AAL2).'}
            </span>
          </div>
          <Link
            href={`/${lang}/mfa`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
          >
            <span>{lang === 'fa' ? 'ورود به MFA' : lang === 'ro' ? 'Autentificare MFA' : 'Verify MFA'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {lang === 'fa' ? 'نقش‌ها و نسخه‌ها' : lang === 'ro' ? 'Roluri și Versiuni' : 'Roles & Versions'} (
          {data?.roles?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assignments'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {lang === 'fa' ? 'تخصیص نقش به اعضا' : lang === 'ro' ? 'Atribuiri Membri' : 'Member Assignments'} (
          {data?.assignments?.length ?? 0})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p>{lang === 'fa' ? 'در حال بارگذاری اطلاعات...' : lang === 'ro' ? 'Se încarcă...' : 'Loading roles...'}</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300">
          <AlertCircle className="w-6 h-6 mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : activeTab === 'roles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data?.roles?.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <Shield className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p>{lang === 'fa' ? 'هیچ نقشی تعریف نشده است.' : lang === 'ro' ? 'Niciun rol găsit.' : 'No roles found.'}</p>
            </div>
          ) : (
            data?.roles?.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                    <code className="text-xs font-mono text-gray-500 dark:text-gray-400">{role.code}</code>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 font-medium rounded-full ${
                      role.lifecycle_status === 'published'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                        : role.lifecycle_status === 'draft'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {role.lifecycle_status}
                  </span>
                </div>

                {role.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between">
                    <span>{lang === 'fa' ? 'نسخه نقش:' : 'Role Version:'}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">v{role.role_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'fa' ? 'سقف محدوده:' : 'Scope Ceiling:'}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{role.scope_ceiling}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'fa' ? 'ماژول‌های متصل:' : 'Modules:'}</span>
                    <span>{role.modules.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'fa' ? 'دسترسی‌ها:' : 'Permissions:'}</span>
                    <span>{role.permissions.length}</span>
                  </div>
                </div>

                {role.lifecycle_status === 'draft' && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    {role.base_role_id && (
                      <button
                        onClick={() => void handleSnapshotTemplate(role)}
                        disabled={actionLoading}
                        className="flex-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg hover:bg-indigo-100"
                      >
                        {lang === 'fa' ? 'کپی از الگو' : 'Copy Template'}
                      </button>
                    )}
                    <button
                      onClick={() => void handlePublishRole(role)}
                      disabled={actionLoading || role.modules.length === 0 || role.permissions.length === 0}
                      className="flex-1 px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                    >
                      {lang === 'fa' ? 'انتشار' : 'Publish'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">{lang === 'fa' ? 'عضو' : 'Member'}</th>
                <th className="px-4 py-3">{lang === 'fa' ? 'نقش' : 'Role'}</th>
                <th className="px-4 py-3">{lang === 'fa' ? 'محدوده' : 'Scope'}</th>
                <th className="px-4 py-3">{lang === 'fa' ? 'هدف' : 'Target'}</th>
                <th className="px-4 py-3">{lang === 'fa' ? 'علت' : 'Reason'}</th>
                <th className="px-4 py-3 text-right">{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {data?.assignments?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    {lang === 'fa'
                      ? 'هیچ تخصیص نقش فعالی وجود ندارد.'
                      : 'No active role assignments.'}
                  </td>
                </tr>
              ) : (
                data?.assignments?.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {a.member_name || a.membership_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{a.role_name}</td>
                    <td className="px-4 py-3 capitalize">{a.scope_type}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {a.unit_number
                        ? `Unit ${a.unit_number}`
                        : a.building_name
                        ? a.building_name
                        : a.property_name
                        ? a.property_name
                        : 'Entire Workspace'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{a.reason}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void handleRevokeAssignment(a)}
                        disabled={actionLoading}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        {lang === 'fa' ? 'لغو' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Role Draft */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {lang === 'fa' ? 'ایجاد پیش‌نویس نقش جدید' : 'Create Role Draft'}
            </h3>
            {actionError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs rounded-lg">
                {actionError}
              </div>
            )}
            <form onSubmit={handleCreateDraft} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {lang === 'fa' ? 'کد شناسایی نقش (انگلیسی، حروف کوچک)' : 'Role Code (lowercase snake_case)'}
                </label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9_]{3,50}$"
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                  placeholder="e.g. security_lead"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {lang === 'fa' ? 'عنوان نقش' : 'Role Name'}
                </label>
                <input
                  type="text"
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Chief Security Officer"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {lang === 'fa' ? 'سقف محدوده دسترسی' : 'Scope Ceiling'}
                </label>
                <select
                  value={draftCeiling}
                  onChange={(e: any) => setDraftCeiling(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="workspace">Entire Workspace</option>
                  <option value="property">Property Level</option>
                  <option value="building">Building Level</option>
                  <option value="unit">Unit Level</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {lang === 'fa' ? 'الگوی پایه (اختیاری)' : 'Base Template (Optional)'}
                </label>
                <select
                  value={draftBaseRoleId}
                  onChange={(e) => setDraftBaseRoleId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">None (Custom Empty Role)</option>
                  {data?.templates?.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {lang === 'fa' ? 'علت ممیزی و توجیه عملیاتی' : 'Audit Reason (Required, min 5 chars)'}
                </label>
                <textarea
                  required
                  minLength={5}
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
                  placeholder="Reason for creating this role..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100"
                >
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : lang === 'fa' ? 'ایجاد پیش‌نویس' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
