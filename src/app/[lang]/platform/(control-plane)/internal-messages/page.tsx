import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/types";
import { InternalConversationsPanel } from "@/components/platform/InternalConversationsPanel";

export default async function InternalMessagesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <InternalConversationsPanel lang={lang} />;
}
