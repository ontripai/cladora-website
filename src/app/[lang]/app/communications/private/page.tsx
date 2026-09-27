import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/types";
import { PrivateConversationsPanel } from "@/components/customer/PrivateConversationsPanel";

export default async function PrivateCommunicationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <PrivateConversationsPanel lang={lang} />;
}
