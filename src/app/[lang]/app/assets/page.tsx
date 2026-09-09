import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/types";
import { CustomerAssetsDashboard } from "@/components/customer/CustomerAssetsDashboard";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();

  return <CustomerAssetsDashboard lang={lang} />;
}
