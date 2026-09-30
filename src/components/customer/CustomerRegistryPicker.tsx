"use client";

import {useEffect, useId, useState} from "react";
import type {Language} from "@/types";

type Choice = {id: string; unit_code?: string; building_name?: string; property_name?: string; display_name?: string};
const copy = {
  fa: {search: "جستجو", choose: "انتخاب کنید", loading: "در حال بارگذاری…", empty: "گزینهٔ مجازی یافت نشد.", error: "دریافت گزینه‌های مجاز ناموفق بود.", previous: "قبلی", next: "بعدی"},
  ro: {search: "Caută", choose: "Selectează", loading: "Se încarcă…", empty: "Nu există opțiuni autorizate.", error: "Opțiunile nu au putut fi încărcate.", previous: "Înapoi", next: "Înainte"},
  en: {search: "Search", choose: "Select", loading: "Loading…", empty: "No authorized options found.", error: "Unable to load authorized options.", previous: "Previous", next: "Next"},
};
function label(row: Choice) {
  return row.display_name ?? [row.property_name, row.building_name, row.unit_code].filter(Boolean).join(" · ");
}

export function CustomerRegistryPicker({contextId, view, lang, title, value, selectedLabel, onChange, disabled = false}: {
  contextId: string; view: "units" | "parties"; lang: Language; title: string; value: string;
  selectedLabel?: string; onChange: (id: string, label: string) => void; disabled?: boolean;
}) {
  const t = copy[lang];
  const id = useId();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{key: string; rows: Choice[]; total: number; error: boolean} | null>(null);
  const [chosen, setChosen] = useState<{id: string; label: string} | null>(null);
  const requestKey = `${contextId}:${view}:${search}:${offset}`;
  const ready = result?.key === requestKey;
  const rows = ready ? result.rows : [];
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({context_id: contextId, view, limit: "20", offset: String(offset)});
        if (search.trim()) params.set("query", search.trim());
        const response = await fetch(`/api/customer/v1/occupancy?${params}`, {cache: "no-store", signal: controller.signal});
        if (!response.ok) throw new Error("lookup");
        const body = await response.json();
        if (!controller.signal.aborted) setResult({key: requestKey, rows: body.rows ?? [], total: body.total ?? 0, error: false});
      } catch {
        if (!controller.signal.aborted) setResult({key: requestKey, rows: [], total: 0, error: true});
      }
    }, 150);
    return () => {clearTimeout(timer); controller.abort();};
  }, [contextId, view, search, offset, requestKey, disabled]);
  const currentLabel = rows.find(row => row.id === value) ? null : selectedLabel || (chosen?.id === value ? chosen.label : null);
  return <div className="space-y-2">
    <label htmlFor={id} className="block font-semibold">{title}</label>
    <input aria-label={`${t.search} · ${title}`} value={search} disabled={disabled}
      onChange={event => {setSearch(event.target.value); setOffset(0);}} placeholder={t.search}
      className="w-full rounded-lg border p-2 text-xs" />
    <select id={id} required value={value} disabled={disabled || !ready || result.error}
      onChange={event => {
        const row = rows.find(item => item.id === event.target.value);
        const next = row ? {id: row.id, label: label(row)} : null;
        setChosen(next); onChange(next?.id ?? "", next?.label ?? "");
      }} className="w-full rounded-lg border p-2 text-xs">
      <option value="">{ready ? t.choose : t.loading}</option>
      {value && currentLabel ? <option value={value}>{currentLabel}</option> : null}
      {rows.map(row => <option key={row.id} value={row.id}>{label(row)}</option>)}
    </select>
    {ready && result.error ? <p role="alert" className="text-red-700">{t.error}</p> : ready && rows.length === 0 ? <p>{t.empty}</p> : null}
    {ready && result.total > 20 ? <div className="flex gap-2">
      <button type="button" disabled={disabled || offset === 0} onClick={() => setOffset(current => Math.max(0, current - 20))}>{t.previous}</button>
      <button type="button" disabled={disabled || offset + 20 >= result.total} onClick={() => setOffset(current => current + 20)}>{t.next}</button>
    </div> : null}
  </div>;
}
