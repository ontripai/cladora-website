import { notFound } from "next/navigation";
import { CustomerCommunicationsDashboard } from "@/components/customer/CustomerCommunicationsDashboard";
import { isSupportedLocale } from "@/types";

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerCommunicationsDashboard lang={lang} initialView="posts" />;
}
