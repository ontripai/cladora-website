"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AccountSecurityPanel } from "@/components/auth/AccountSecurityPanel";
import type { CustomerContext } from "./CustomerContextProvider";
import type { Language } from "@/types";

type Profile = { display_name: string; email: string; locale: string | null; timezone: string | null };
const copy = {
  ro: { title: "Profilul meu", intro: "Datele contului și rolurile în spațiile de lucru.", name: "Nume afișat", email: "E-mail", save: "Salvează numele", saving: "Se salvează…", saved: "Numele a fost salvat.", failed: "Profilul nu a putut fi încărcat sau salvat. Încercați din nou.", roles: "Spațiile și rolurile mele", switch: "Deschide spațiul", security: "Securitatea contului", back: "Alege spațiul" },
  en: { title: "My profile", intro: "Your account details and workspace roles.", name: "Display name", email: "Email", save: "Save name", saving: "Saving…", saved: "Name saved.", failed: "Could not load or save your profile. Please try again.", roles: "My workspaces and roles", switch: "Open workspace", security: "Account security", back: "Choose workspace" },
  fa: { title: "پروفایل من", intro: "اطلاعات حساب و نقش‌های شما در محیط‌های کاری مختلف.", name: "نام نمایشی", email: "ایمیل", save: "ذخیره نام", saving: "در حال ذخیره…", saved: "نام ذخیره شد.", failed: "بارگذاری یا ذخیرهٔ پروفایل انجام نشد. دوباره تلاش کنید.", roles: "محیط‌ها و نقش‌های من", switch: "ورود به محیط", security: "امنیت حساب", back: "انتخاب محیط کار" },
};

export function CustomerProfile({ lang }: { lang: Language }) {
  const t = copy[lang];
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/customer/v1/profile", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("profile"); return response.json() as Promise<Profile>; }),
      fetch("/api/customer/v1/contexts", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ contexts: CustomerContext[] }> : { contexts: [] }),
    ]).then(([data, available]) => { if (!cancelled) { setProfile(data); setName(data.display_name); setContexts(available.contexts); } })
      .catch(() => { if (!cancelled) setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [t.failed]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/customer/v1/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      if (!response.ok) throw new Error("profile");
      const updated = await response.json() as { display_name: string };
      setProfile((current) => current && { ...current, display_name: updated.display_name });
      setName(updated.display_name);
      setStatus(t.saved);
      window.dispatchEvent(new Event("cladora:profile-updated"));
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-6" dir={lang === "fa" ? "rtl" : "ltr"}>
    <Link href={`/${lang}/account?choose=1`} className="text-sm font-semibold text-teal-800 underline">{t.back}</Link>
    <header><h1 className="text-2xl font-bold text-slate-900">{t.title}</h1><p className="mt-2 text-slate-600">{t.intro}</p></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {!profile ? <p role="status">{status || "…"}</p> : <form onSubmit={(event) => void save(event)} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">{t.name}
          <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
        <div className="text-sm text-slate-700"><span className="font-medium">{t.email}</span><p dir="ltr" className="mt-1 text-start text-slate-900">{profile.email}</p></div>
        <button type="submit" disabled={busy || name.trim() === profile.display_name || name.trim().length < 2} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t.saving : t.save}</button>
        {status && <p role="status" className="text-sm text-teal-800">{status}</p>}
      </form>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold text-slate-900">{t.roles}</h2>
      <ul className="mt-3 space-y-3">{contexts.map((context) => <li key={context.context_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <span><strong className="block text-slate-900">{context.tenant_name} · {context.context_label}</strong><span className="text-slate-600">{context.role_name}</span></span>
        <Link href={`/${lang}/app/dashboard?context=${encodeURIComponent(context.context_id)}`} className="rounded-lg border border-teal-700 px-3 py-2 text-teal-800">{t.switch}</Link>
      </li>)}</ul>
    </section>
    <section aria-label={t.security}><AccountSecurityPanel lang={lang} continueTo={`/${lang}/profile`} /></section>
  </div>;
}
