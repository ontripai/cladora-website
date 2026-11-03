import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerAmenityReservations } from '@/components/customer/CustomerAmenityReservations';

export default async function AmenitiesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerAmenityReservations lang={lang} />;
}
