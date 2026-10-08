'use client';

import type { Language } from '@/types';
import type { z } from 'zod';
import type { serviceResourceReferenceSchema } from '@/lib/customer/service-offering-v14-schema';

export type NamedServiceResource = {
  reference: z.infer<typeof serviceResourceReferenceSchema>;
  label: string;
  detail: string | null;
};

const copy = {
  ro: {
    label: 'Resursa pentru serviciu',
    placeholder: 'Alege resursa',
    help: 'Alege după nume. Identificatorii interni nu sunt afișați.',
  },
  en: {
    label: 'Resource for the service',
    placeholder: 'Choose the resource',
    help: 'Choose by name. Internal identifiers are not displayed.',
  },
  fa: {
    label: 'منبع مربوط به خدمت',
    placeholder: 'منبع را انتخاب کنید',
    help: 'منبع را با نام انتخاب کنید؛ شناسه‌های داخلی نمایش داده نمی‌شوند.',
  },
} as const;

function referenceValue(resource: NamedServiceResource['reference']) {
  return `${resource.resource_id}:${resource.resource_version}`;
}

export function ServiceResourcePicker({
  lang,
  resources,
  value,
  onChange,
  error,
  disabled = false,
}: {
  lang: Language;
  resources: NamedServiceResource[];
  value: NamedServiceResource['reference'] | null;
  onChange: (resource: NamedServiceResource['reference'] | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const t = copy[lang];
  const errorId = 'service-resource-error';
  return <fieldset dir={lang === 'fa' ? 'rtl' : 'ltr'} disabled={disabled} className="min-w-0 space-y-2">
    <label htmlFor="service-resource" className="block text-sm font-semibold text-[#102A43]">{t.label}</label>
    <select
      id="service-resource"
      value={value ? referenceValue(value) : ''}
      onChange={event => {
        const selected = resources.find(resource => referenceValue(resource.reference) === event.target.value);
        onChange(selected?.reference ?? null);
      }}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : 'service-resource-help'}
      className="w-full min-w-0 rounded-xl border border-[#C7D3DD] bg-white px-3 py-3 text-base text-[#102A43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A6E] disabled:bg-[#F1F5F8]"
    >
      <option value="">{t.placeholder}</option>
      {resources.map(resource => <option key={referenceValue(resource.reference)} value={referenceValue(resource.reference)}>
        {resource.label}{resource.detail ? ` — ${resource.detail}` : ''}
      </option>)}
    </select>
    <p id="service-resource-help" className="text-xs text-[#52667A]">{t.help}</p>
    {error ? <p id={errorId} role="alert" className="text-sm font-medium text-[#A61B1B]">{error}</p> : null}
  </fieldset>;
}
