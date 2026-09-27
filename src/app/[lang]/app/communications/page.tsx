import { notFound } from "next/navigation";
import { CustomerCommunicationsDashboard } from "@/components/customer/CustomerCommunicationsDashboard";
import { isSupportedLocale } from "@/types";
import Link from "next/link";

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <><div className="mx-auto max-w-6xl px-4 pt-6"><Link href={`/${lang}/app/communications/private`} className="inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white">{{ro: "Conversații private", en: "Private conversations", fa: "گفت‌وگوهای خصوصی"}[lang]}</Link></div><CustomerCommunicationsDashboard lang={lang} initialView="posts" /></>;
}
