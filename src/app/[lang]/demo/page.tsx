import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import { Language } from '@/types';
import { DemoAuthPortal } from '@/components/demo/DemoAuthPortal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/demo', params.lang);
}

export default async function DemoEntryPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <DemoAuthPortal lang={params.lang} />
    </main>
  );
}
