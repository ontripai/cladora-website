import type { Language } from "@/types";
import { RelationshipReviewPanel } from "@/components/customer/RelationshipReviewPanel";

export default async function RelationshipReviewPage({ params }: { params: Promise<{ lang: Language }> }) {
  const { lang } = await params;
  return <RelationshipReviewPanel lang={lang} />;
}
