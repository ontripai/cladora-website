'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Language } from '@/types';

export interface GuideReferenceView { id: string; label: string; href?: string }
export interface GuideStepView { id: string; title: string; body: string; references: GuideReferenceView[] }
export interface ExperienceGuideView { guide_id: string; workspace_id: string; title: string; audience_label: string; status: 'draft' | 'published' | 'cancelled'; version: number; steps: GuideStepView[]; can_edit: boolean }
export interface NamedGuideTarget { id: string; label: string; type: 'document' | 'service' | 'event' | 'community' }
export interface ExperienceGuideCommands { saveDraft(input: { guide_id: string; title: string; step_title: string; step_body: string; target_id: string | null }): Promise<void> }

const copy = {
  ro: { heading: 'Ghid', audience: 'Public', editor: 'Editează ghidul', title: 'Titlu', step: 'Titlul pasului', body: 'Instrucțiuni', reference: 'Referință opțională', none: 'Fără referință', save: 'Salvează ciorna', retry: 'Acțiunea nu a reușit. Datele introduse au fost păstrate.', pending: 'Ghidul nu este disponibil momentan.' },
  en: { heading: 'Guide', audience: 'Audience', editor: 'Edit guide', title: 'Title', step: 'Step title', body: 'Instructions', reference: 'Optional reference', none: 'No reference', save: 'Save draft', retry: 'The action failed. Your input has been preserved.', pending: 'Guide is currently unavailable.' },
  fa: { heading: 'راهنما', audience: 'مخاطب', editor: 'ویرایش راهنما', title: 'عنوان', step: 'عنوان گام', body: 'دستورالعمل', reference: 'ارجاع اختیاری', none: 'بدون ارجاع', save: 'ذخیرهٔ پیش‌نویس', retry: 'عملیات انجام نشد. ورودی شما حفظ شده است.', pending: 'راهنما در حال حاضر در دسترس نیست.' },
} as const;

const feedback = {
  ro: { sending: 'Se trimite…', saved: 'Ciorna ghidului a fost salvată.' },
  en: { sending: 'Sending…', saved: 'Guide draft saved.' },
  fa: { sending: 'در حال ارسال…', saved: 'پیش‌نویس راهنما ذخیره شد.' },
} as const;

interface GuideDraft {
  title: string;
  stepTitle: string;
  body: string;
  targetId: string;
}

type GuideDraftField = keyof GuideDraft;
type GuideFieldState<T> = Record<GuideDraftField, T>;

const guideContentFields = ['title', 'stepTitle', 'body'] as const satisfies readonly GuideDraftField[];

function draftFromGuide(guide: ExperienceGuideView): GuideDraft {
  const first = guide.steps[0];
  return { title: guide.title, stepTitle: first?.title ?? '', body: first?.body ?? '', targetId: '' };
}

function GuideEditor({ lang, guide, targets, commands, onChanged }: { lang: Language; guide: ExperienceGuideView; targets: NamedGuideTarget[]; commands: ExperienceGuideCommands; onChanged?: () => void }) {
  const t = copy[lang];
  const titleId = useId();
  const statusId = useId();
  const pending = useRef(false);
  const mounted = useRef(true);
  const dirty = useRef<GuideFieldState<boolean>>({ title: false, stepTitle: false, body: false, targetId: false });
  const revisions = useRef<GuideFieldState<number>>({ title: 0, stepTitle: 0, body: 0, targetId: 0 });
  const acceptedSave = useRef<{ baseVersion: number; revisions: GuideFieldState<number> } | null>(null);
  const [draft, setDraft] = useState<GuideDraft>(() => draftFromGuide(guide));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const incomingStepTitle = guide.steps[0]?.title ?? '';
  const incomingBody = guide.steps[0]?.body ?? '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const incoming: GuideDraft = { title: guide.title, stepTitle: incomingStepTitle, body: incomingBody, targetId: '' };
    const saved = acceptedSave.current;
    const confirmsSave = saved !== null && guide.version > saved.baseVersion;
    setDraft((current) => {
      const next = { ...current };
      for (const field of guideContentFields) {
        const unchangedSinceSave = confirmsSave && revisions.current[field] <= saved.revisions[field];
        if (!dirty.current[field] || unchangedSinceSave) {
          next[field] = incoming[field];
          dirty.current[field] = false;
        }
      }
      return next;
    });
    if (confirmsSave) acceptedSave.current = null;
  }, [guide.title, guide.version, incomingStepTitle, incomingBody]);

  function change<K extends GuideDraftField>(field: K, value: GuideDraft[K]) {
    dirty.current[field] = true;
    revisions.current[field] += 1;
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    const submitted = { ...draft };
    const submittedRevisions = { ...revisions.current };
    try {
      await commands.saveDraft({ guide_id: guide.guide_id, title: submitted.title, step_title: submitted.stepTitle, step_body: submitted.body, target_id: submitted.targetId || null });
      if (!mounted.current) return;
      acceptedSave.current = { baseVersion: guide.version, revisions: submittedRevisions };
      setMessage(feedback[lang].saved);
      onChanged?.();
    } catch {
      if (mounted.current) setError(t.retry);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <form aria-labelledby={titleId} aria-describedby={error ? `${statusId}-error` : statusId} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <h2 id={titleId} className="font-bold sm:col-span-2">{t.editor}</h2>
    <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="text-sm text-teal-800 sm:col-span-2">{busy ? feedback[lang].sending : message}</p>
    {error ? <p id={`${statusId}-error`} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{error}</p> : null}
    <fieldset aria-busy={busy} disabled={busy} className="contents">
      <label className="space-y-1 text-sm"><span>{t.title}</span><input required maxLength={160} value={draft.title} onChange={(event) => change('title', event.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
      <label className="space-y-1 text-sm"><span>{t.step}</span><input required maxLength={160} value={draft.stepTitle} onChange={(event) => change('stepTitle', event.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
      <label className="space-y-1 text-sm sm:col-span-2"><span>{t.body}</span><textarea required maxLength={5000} value={draft.body} onChange={(event) => change('body', event.target.value)} className="min-h-28 w-full rounded-lg border px-3 py-2" /></label>
      <label className="space-y-1 text-sm sm:col-span-2"><span>{t.reference}</span><select value={draft.targetId} onChange={(event) => change('targetId', event.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">{t.none}</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
      <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:w-fit">{t.save}</button>
    </fieldset>
  </form>;
}

export function CustomerExperienceGuide({ lang, guide, targets = [], commands, onChanged }: { lang: Language; guide: ExperienceGuideView | null; targets?: NamedGuideTarget[]; commands: ExperienceGuideCommands | null; onChanged?: () => void }) {
  const t = copy[lang];
  if (!guide) return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl border bg-white p-5"><p role="status">{t.pending}</p></section>;
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6" aria-labelledby="ce012-guide-title">
    <header><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{t.heading}</p><h1 id="ce012-guide-title" className="text-xl font-bold text-[#102A43]">{guide.title}</h1><p className="text-sm text-[#52667A]">{t.audience}: {guide.audience_label}</p></header>
    <ol className="space-y-4">{guide.steps.map((step, index) => <li key={step.id} className="rounded-xl bg-slate-50 p-4"><h2 className="font-semibold">{index + 1}. {step.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{step.body}</p>{step.references.length ? <ul className="mt-3 flex flex-wrap gap-2">{step.references.map((reference) => <li key={reference.id}>{reference.href ? <a className="text-sm font-semibold text-teal-700 underline" href={reference.href}>{reference.label}</a> : <span className="text-sm text-[#52667A]">{reference.label}</span>}</li>)}</ul> : null}</li>)}</ol>
    {guide.can_edit && commands ? <GuideEditor key={`${guide.workspace_id}:${guide.guide_id}`} lang={lang} guide={guide} targets={targets} commands={commands} onChanged={onChanged} /> : null}
  </section>;
}
