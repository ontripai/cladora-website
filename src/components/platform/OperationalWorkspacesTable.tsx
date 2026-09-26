"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import type {
  CustomerWorkspace,
  WorkspaceLifecycleStatus,
} from "@/types/platform";
import { WorkspaceAccessBasisDialog } from "@/components/platform/WorkspaceAccessBasisDialog";
import { isPrimaryWorkspaceRoleAvailable, primaryWorkspaceRole } from "@/lib/customer/primary-workspace-role";

const PAGE_SIZE = 20;
type Locale = "ro" | "en" | "fa";
type LoadState = "loading" | "ready" | "error";

interface WorkspaceResponse {
  workspaces: CustomerWorkspace[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface InvitationRole {
  id: string;
  code: "association_admin" | "property_manager";
  name: string;
}

const copy = {
  ro: {
    title: "Spații de lucru înregistrate",
    total: "Total",
    loading: "Se încarcă spațiile de lucru autorizate…",
    emptyTitle: "Nu există spații de lucru disponibile",
    emptyBody:
      "Nu există încă spații de lucru sau operatorul curent nu are o alocare activă.",
    errorTitle: "Spațiile de lucru nu au putut fi încărcate",
    retry: "Reîncearcă",
    previous: "Anterior",
    next: "Următorul",
    page: "Pagina",
    workspace: "Spațiu de lucru și entitate",
    owner: "Responsabil comercial",
    advance: "Treci la etapa următoare",
    advanceReason: "Motivul schimbării etapei",
    advanceSuccess: "Etapa spațiului de lucru a fost actualizată.",
    advanceFailed: "Schimbarea etapei a eșuat. Reîmprospătează și încearcă din nou.",
    type: "Tip",
    environment: "Mediu",
    status: "Stare ciclu de viață",
    version: "Versiune",
    activated: "Activat la",
    actions: "Acțiuni",
    invite: "Invită administrator",
    inviteTitle: "Invită administratorul principal",
    inviteIntro: "Invitația este disponibilă numai în etapa PROVISIONING și expiră în cel mult 72 de ore.",
    email: "E-mail",
    role: "Rol",
    reason: "Motivul invitației",
    reasonPlaceholder: "Activarea administratorului principal al asociației",
    expiry: "Valabilitate",
    hours: "ore",
    cancel: "Anulează",
    send: "Trimite invitația",
    sending: "Se trimite…",
    sent: "Invitația a fost trimisă în siguranță.",
    invitationFailed: "Invitația nu a putut fi trimisă.",
    rolesFailed: "Rolurile de invitație nu au putut fi încărcate.",
  },
  en: {
    title: "Registered workspaces",
    total: "Total",
    loading: "Loading authorized workspaces…",
    emptyTitle: "No workspaces available",
    emptyBody:
      "No workspaces exist yet, or the current operator has no active assignment.",
    errorTitle: "Workspaces could not be loaded",
    retry: "Retry",
    previous: "Previous",
    next: "Next",
    page: "Page",
    workspace: "Workspace & entity",
    owner: "Commercial owner",
    advance: "Advance stage",
    advanceReason: "Reason for stage change",
    advanceSuccess: "Workspace stage updated.",
    advanceFailed: "Stage change failed. Refresh and retry.",
    type: "Type",
    environment: "Environment",
    status: "Lifecycle status",
    version: "Version",
    activated: "Activated",
    actions: "Actions",
    invite: "Invite administrator",
    inviteTitle: "Invite primary administrator",
    inviteIntro: "Invitations are available only during PROVISIONING and expire within 72 hours.",
    email: "Email",
    role: "Role",
    reason: "Invitation reason",
    reasonPlaceholder: "Activate the association's primary administrator",
    expiry: "Validity",
    hours: "hours",
    cancel: "Cancel",
    send: "Send invitation",
    sending: "Sending…",
    sent: "The invitation was sent securely.",
    invitationFailed: "The invitation could not be sent.",
    rolesFailed: "Invitation roles could not be loaded.",
  },
  fa: {
    title: "محیط‌های کاری ثبت‌شده",
    total: "مجموع",
    loading: "در حال دریافت محیط‌های کاری مجاز…",
    emptyTitle: "محیط کاری در دسترس نیست",
    emptyBody: "هنوز محیط کاری ایجاد نشده یا کاربر فعلی تخصیص فعال ندارد.",
    errorTitle: "دریافت محیط‌های کاری ناموفق بود",
    retry: "تلاش دوباره",
    previous: "قبلی",
    next: "بعدی",
    page: "صفحه",
    workspace: "محیط کاری و مجموعه",
    owner: "مسئول تجاری",
    advance: "مرحلهٔ بعد",
    advanceReason: "دلیل تغییر مرحله",
    advanceSuccess: "مرحلهٔ محیط کاری تغییر کرد.",
    advanceFailed: "تغییر مرحله انجام نشد؛ صفحه را تازه‌سازی کنید.",
    type: "نوع",
    environment: "محیط",
    status: "وضعیت چرخه حیات",
    version: "نسخه",
    activated: "تاریخ فعال‌سازی",
    actions: "عملیات",
    invite: "دعوت مدیر ساختمان",
    inviteTitle: "دعوت مدیر اصلی ساختمان",
    inviteIntro: "دعوت فقط در مرحله PROVISIONING ممکن است و حداکثر تا ۷۲ ساعت اعتبار دارد.",
    email: "ایمیل",
    role: "نقش",
    reason: "دلیل دعوت",
    reasonPlaceholder: "فعال‌سازی مدیر اصلی ساختمان",
    expiry: "مدت اعتبار",
    hours: "ساعت",
    cancel: "انصراف",
    send: "ارسال دعوت‌نامه",
    sending: "در حال ارسال…",
    sent: "دعوت‌نامه به‌صورت امن ارسال شد.",
    invitationFailed: "ارسال دعوت‌نامه انجام نشد.",
    rolesFailed: "دریافت نقش‌های دعوت ناموفق بود.",
  },
} as const;

function statusClass(status: WorkspaceLifecycleStatus) {
  if (status === "ACTIVE")
    return "border-emerald-500/40 bg-emerald-950/80 text-emerald-300";
  if (status === "PROVISIONING")
    return "border-teal-500/40 bg-teal-950/80 text-teal-300";
  if (["CONTRACT_PENDING", "PAYMENT_PENDING", "UNDER_REVIEW"].includes(status))
    return "border-amber-500/40 bg-amber-950/80 text-amber-300";
  if (["SUSPENDED", "PAST_DUE"].includes(status))
    return "border-rose-500/40 bg-rose-950/80 text-rose-300";
  if (["TERMINATED", "ARCHIVED"].includes(status))
    return "border-slate-700 bg-slate-900 text-slate-400";
  return "border-[#1E3A5A] bg-[#142A40] text-slate-300";
}

function localeCode(lang: Locale) {
  return lang === "ro" ? "ro-RO" : lang === "fa" ? "fa-IR" : "en-GB";
}

const nextStage: Partial<Record<WorkspaceLifecycleStatus, WorkspaceLifecycleStatus>> = {
  LEAD: 'UNDER_REVIEW',
  UNDER_REVIEW: 'APPROVED',
  APPROVED: 'CONTRACT_PENDING',
  CONTRACT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_PENDING: 'PROVISIONING',
};

const suggestedTransitionReasons: Record<Locale, Partial<Record<WorkspaceLifecycleStatus, string>>> = {
  fa: {
    LEAD: 'آغاز بررسی درخواست و نیازهای راه‌اندازی محیط کاری.',
    UNDER_REVIEW: 'تأیید درخواست محیط کاری برای ادامه فرایند راه‌اندازی.',
    APPROVED: 'انتقال درخواست تأییدشده به مرحله آماده‌سازی قرارداد.',
    CONTRACT_PENDING: 'انتقال محیط کاری به مرحله بررسی وضعیت پرداخت.',
    PAYMENT_PENDING: 'انتقال محیط کاری به مرحله آماده‌سازی فنی و بررسی پیش‌نیازهای فعال‌سازی.',
  },
  ro: {
    LEAD: 'Începerea evaluării cererii și a cerințelor de configurare a spațiului de lucru.',
    UNDER_REVIEW: 'Aprobarea cererii pentru continuarea configurării spațiului de lucru.',
    APPROVED: 'Trecerea cererii aprobate la etapa de pregătire a contractului.',
    CONTRACT_PENDING: 'Trecerea spațiului de lucru la etapa de verificare a stării plății.',
    PAYMENT_PENDING: 'Trecerea spațiului de lucru la pregătirea tehnică și verificarea condițiilor de activare.',
  },
  en: {
    LEAD: 'Begin reviewing the workspace request and setup requirements.',
    UNDER_REVIEW: 'Approve the workspace request to continue the setup process.',
    APPROVED: 'Move the approved request to contract preparation.',
    CONTRACT_PENDING: 'Move the workspace to payment status review.',
    PAYMENT_PENDING: 'Move the workspace to technical preparation and activation prerequisite checks.',
  },
};

export function OperationalWorkspacesTable({
  lang: requestedLang,
  canTransition = false,
}: {
  lang: string;
  canTransition?: boolean;
}) {
  const lang: Locale =
    requestedLang === "ro" || requestedLang === "fa" ? requestedLang : "en";
  const labels = copy[lang];
  const [state, setState] = useState<LoadState>("loading");
  const [workspaces, setWorkspaces] = useState<CustomerWorkspace[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [inviteWorkspace, setInviteWorkspace] = useState<CustomerWorkspace | null>(null);
  const [basisWorkspace, setBasisWorkspace] = useState<CustomerWorkspace | null>(null);
  const [transitionWorkspace, setTransitionWorkspace] = useState<CustomerWorkspace | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/platform/v1/workspaces?limit=${PAGE_SIZE}&offset=${offset}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as WorkspaceResponse & {
          error?: { code?: string };
        };
        if (!response.ok)
          throw new Error(body.error?.code || `HTTP_${response.status}`);
        return body;
      })
      .then((body) => {
        setWorkspaces(body.workspaces);
        setTotal(body.pagination.total);
        setHasMore(body.pagination.hasMore);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
        setState("error");
      });
    return () => controller.abort();
  }, [offset, retryCount]);
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#1E3A5A] bg-[#0F2236] shadow-sm"
      aria-busy={state === "loading"}
    >
      <div className="flex items-center justify-between border-b border-[#1E3A5A] p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {labels.title}
        </h2>
        <span className="font-mono text-xs text-slate-400">
          {labels.total}: {total}
        </span>
      </div>
      {state === "loading" ? (
        <div
          className="flex min-h-56 items-center justify-center gap-2 p-8 text-sm text-slate-300"
          role="status"
        >
          <LoaderCircle
            className="h-5 w-5 animate-spin text-emerald-400"
            aria-hidden="true"
          />
          <span>{labels.loading}</span>
        </div>
      ) : state === "error" ? (
        <div
          className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center"
          role="alert"
        >
          <AlertTriangle
            className="h-7 w-7 text-amber-400"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold text-white">{labels.errorTitle}</p>
            <p className="mt-1 font-mono text-xs text-slate-400">{errorCode}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setErrorCode(null);
              setRetryCount((value) => value + 1);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {labels.retry}
          </button>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <p className="font-bold text-white">{labels.emptyTitle}</p>
          <p className="mt-2 max-w-lg text-xs text-slate-400">
            {labels.emptyBody}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-[#1E3A5A] bg-[#081320] text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {labels.workspace}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.type}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.environment}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.status}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.version}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.activated}
                </th>
                <th scope="col" className="px-4 py-3">
                  {labels.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5A] text-slate-300">
              {workspaces.map((workspace) => (
                <tr
                  key={workspace.id}
                  className="transition hover:bg-[#12283E]"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{workspace.tenant_legal_name || workspace.commercial_owner}</div>
                    <div className="text-[10px] text-slate-400">{labels.owner}: {workspace.commercial_owner}</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      ID: {workspace.id} · Tenant: {workspace.tenant_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-[#1E3A5A] bg-[#142A40] px-2 py-0.5 font-mono text-[10px] font-bold">
                      {workspace.workspace_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${workspace.environment === "PRODUCTION" ? "border-purple-500/40 bg-purple-950/60 text-purple-300" : "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"}`}
                    >
                      {workspace.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusClass(workspace.lifecycle_status)}`}
                    >
                      {workspace.lifecycle_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    v{workspace.version}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {workspace.activated_at
                      ? new Intl.DateTimeFormat(localeCode(lang), {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(workspace.activated_at))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">{canTransition && <button type="button" onClick={() => setBasisWorkspace(workspace)} className="rounded border border-amber-400/40 px-2 py-1 text-amber-200">{lang === 'fa' ? 'مبنای دسترسی' : lang === 'ro' ? 'Temei acces' : 'Access basis'}</button>}{canTransition && nextStage[workspace.lifecycle_status] && <button type="button" onClick={() => { setTransitionError(''); setTransitionWorkspace(workspace); }} className="rounded border border-teal-500/40 px-2 py-1 text-teal-300">{labels.advance}</button>}
                    {workspace.lifecycle_status === "PROVISIONING" && isPrimaryWorkspaceRoleAvailable(workspace.workspace_type) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setInviteWorkspace(workspace);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 font-bold text-emerald-300 hover:bg-emerald-900/70"
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        {labels.invite}
                      </button>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state === "ready" && total > 0 ? (
        <nav
          className="flex items-center justify-between border-t border-[#1E3A5A] p-4"
          aria-label={`${labels.page} ${pageNumber}`}
        >
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => {
              setState("loading");
              setOffset((value) => Math.max(0, value - PAGE_SIZE));
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1E3A5A] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-[#14324F] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
            {labels.previous}
          </button>
          <span className="text-xs text-slate-400">
            {labels.page} {pageNumber} / {pageCount}
          </span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => {
              setState("loading");
              setOffset((value) => value + PAGE_SIZE);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1E3A5A] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-[#14324F] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {labels.next}
            <ChevronRight
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
        </nav>
      ) : null}
      {notice ? (
        <p role="status" className="border-t border-emerald-500/30 bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-300">
          {notice}
        </p>
      ) : null}
      {basisWorkspace ? <WorkspaceAccessBasisDialog workspace={basisWorkspace} lang={lang} onClose={() => setBasisWorkspace(null)} /> : null}
      {inviteWorkspace ? (
        <InvitationDialog
          lang={lang}
          workspace={inviteWorkspace}
          labels={labels}
          onClose={() => setInviteWorkspace(null)}
          onSent={() => {
            setInviteWorkspace(null);
            setNotice(labels.sent);
          }}
        />
      ) : null}
      {transitionWorkspace && nextStage[transitionWorkspace.lifecycle_status] && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="presentation">
        <form className="w-full max-w-lg space-y-4 rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-6 text-sm text-white" onSubmit={async (event) => {
          event.preventDefault(); setTransitionBusy(true); setTransitionError('');
          const reason = String(new FormData(event.currentTarget).get('reason') || '').trim();
          try {
            const response = await fetch(`/api/platform/v1/workspaces/${transitionWorkspace.id}/transitions`, {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target_status: nextStage[transitionWorkspace.lifecycle_status], expected_version: transitionWorkspace.version, reason }),
            });
            if (!response.ok) throw new Error();
            setTransitionWorkspace(null); setNotice(labels.advanceSuccess); setRetryCount(value => value + 1);
          } catch { setTransitionError(labels.advanceFailed); }
          finally { setTransitionBusy(false); }
        }}>
          <h2 className="font-bold">{transitionWorkspace.tenant_legal_name || transitionWorkspace.commercial_owner}</h2>
          <p>{transitionWorkspace.lifecycle_status} → {nextStage[transitionWorkspace.lifecycle_status]}</p>
          <p className="text-xs text-amber-200">{lang === 'fa' ? 'تغییر مرحله به‌تنهایی هیچ دعوت یا ایمیلی ارسال نمی‌کند.' : lang === 'ro' ? 'Schimbarea etapei nu trimite invitații sau e-mailuri.' : 'Changing the stage does not send an invitation or email.'}</p>
          <label className="block">{labels.advanceReason}<textarea key={`${transitionWorkspace.id}:${transitionWorkspace.lifecycle_status}:${lang}`} name="reason" defaultValue={suggestedTransitionReasons[lang][transitionWorkspace.lifecycle_status] ?? ''} minLength={3} maxLength={500} required className="mt-2 w-full rounded border border-[#1E3A5A] bg-[#081320] p-3" /></label>
          {transitionError && <p role="alert" className="text-rose-300">{transitionError}</p>}
          <div className="flex gap-2"><button disabled={transitionBusy} className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">{labels.advance}</button><button type="button" onClick={() => setTransitionWorkspace(null)} className="rounded border border-[#1E3A5A] px-4 py-2">{labels.cancel}</button></div>
        </form>
      </div>}
    </section>
  );
}

function InvitationDialog({
  lang,
  workspace,
  labels,
  onClose,
  onSent,
}: {
  lang: Locale;
  workspace: CustomerWorkspace;
  labels: (typeof copy)[Locale];
  onClose: () => void;
  onSent: () => void;
}) {
  const [roles, setRoles] = useState<InvitationRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/platform/v1/workspaces/invitation-roles', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as { roles?: InvitationRole[] };
        if (!response.ok) throw new Error('ROLE_CATALOG_UNAVAILABLE');
        setRoles(body.roles ?? []);
        setRolesLoading(false);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(labels.rolesFailed);
        setRolesLoading(false);
      });
    return () => controller.abort();
  }, [labels.rolesFailed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/platform/v1/workspaces/${workspace.id}/invitations`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        role_id: form.get('role_id'),
        lang,
        reason: form.get('reason'),
        expires_in_hours: Number(form.get('expires_in_hours')),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      setError(body?.error?.code === 'ACTIVE_INVITATION_EXISTS'
        ? `${labels.invitationFailed} ACTIVE_INVITATION_EXISTS`
        : labels.invitationFailed);
      return;
    }
    onSent();
  }

  const preferredRole = primaryWorkspaceRole(workspace.workspace_type);
  const compatibleRoles = isPrimaryWorkspaceRoleAvailable(workspace.workspace_type)
    ? roles.filter(role => role.code === preferredRole) : [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="presentation">
      <form onSubmit={submit} className="w-full max-w-xl space-y-5 rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-6 text-start text-sm text-white" aria-labelledby="workspace-invitation-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="workspace-invitation-title" className="text-lg font-bold">{labels.inviteTitle}</h2>
            <p className="mt-1 text-xs text-slate-400">{workspace.commercial_owner}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5A] p-2 text-slate-300" aria-label={labels.cancel}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-200">{labels.inviteIntro}</p>
        <label className="block space-y-2">
          <span className="font-bold">{labels.email}</span>
          <input required name="email" type="email" autoComplete="email" maxLength={320} className="w-full rounded-lg border border-[#1E3A5A] bg-[#081320] p-3" />
        </label>
        <label className="block space-y-2">
          <span className="font-bold">{labels.role}</span>
          <select required name="role_id" disabled={rolesLoading || compatibleRoles.length === 0} defaultValue="" className="w-full rounded-lg border border-[#1E3A5A] bg-[#081320] p-3">
            <option value="" disabled>{rolesLoading ? '…' : labels.role}</option>
            {compatibleRoles.map((role) => (
              <option key={role.id} value={role.id}>{role.name} · {role.code}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="font-bold">{labels.reason}</span>
          <textarea required name="reason" minLength={3} maxLength={500} placeholder={labels.reasonPlaceholder} className="min-h-24 w-full rounded-lg border border-[#1E3A5A] bg-[#081320] p-3" />
        </label>
        <label className="block space-y-2">
          <span className="font-bold">{labels.expiry}</span>
          <select name="expires_in_hours" defaultValue="72" className="w-full rounded-lg border border-[#1E3A5A] bg-[#081320] p-3">
            {[24, 48, 72].map((hours) => <option key={hours} value={hours}>{hours} {labels.hours}</option>)}
          </select>
        </label>
        {error ? <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5A] px-4 py-2 text-slate-200">{labels.cancel}</button>
          <button disabled={busy || rolesLoading || compatibleRoles.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {busy ? labels.sending : labels.send}
          </button>
        </div>
      </form>
    </div>
  );
}
