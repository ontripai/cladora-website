import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  WorkspaceInvitationContinuation,
  type ClaimableWorkspaceInvitation,
} from '@/components/auth/WorkspaceInvitationContinuation';
import { CladoraBrand } from '@/components/brand/CladoraBrand';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import type { Language } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Complete CLADORA invitation',
  robots: { index: false, follow: false, nocache: true },
};

const unavailableCopy = {
  ro: {
    title: 'Invitația nu este disponibilă',
    message: 'Invitația nu poate fi continuată. Poate fi expirată, anulată, deja utilizată sau indisponibilă pentru această sesiune.',
    action: 'Înapoi la autentificare',
  },
  en: {
    title: 'Invitation unavailable',
    message: 'This invitation cannot be continued. It may be expired, cancelled, already used, or unavailable for this session.',
    action: 'Back to sign in',
  },
  fa: {
    title: 'دعوت‌نامه در دسترس نیست',
    message: 'ادامه این دعوت‌نامه ممکن نیست. ممکن است منقضی، لغو، قبلاً استفاده‌شده یا برای این نشست نامعتبر باشد.',
    action: 'بازگشت به ورود',
  },
} as const;

function Unavailable({ lang }: { lang: Language }) {
  const t = unavailableCopy[lang];
  return (
    <div className="card-proptech w-full max-w-md space-y-5 border-[#D3DCE6] bg-white p-8 text-center shadow-elevated">
      <CladoraBrand variant="symbol" decorative className="mx-auto h-12 w-12" />
      <AlertTriangle aria-hidden="true" className="mx-auto h-9 w-9 text-[#B42318]" />
      <h1 className="text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
      <p className="text-xs leading-6 text-[#334E68]">{t.message}</p>
      <Link href={`/${lang}/login`} className="inline-flex w-full items-center justify-center rounded-xl bg-[#087A6E] px-4 py-3 text-xs font-extrabold text-white">
        {t.action}
      </Link>
    </div>
  );
}

export default async function InvitationContinuationPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;
  let invitations: ClaimableWorkspaceInvitation[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (!claimsError && claims?.claims?.sub) {
      const { data, error } = await supabase
        .schema('customer_api')
        .rpc('list_my_claimable_workspace_invitations_v1');
      if (!error && Array.isArray(data)) {
        invitations = data as unknown as ClaimableWorkspaceInvitation[];
      }
      if (invitations.length === 0) {
        const { data: reviewer, error: reviewerError } = await supabase
          .schema('customer_api')
          .rpc('my_pilot_setup_reviewer_v1');
        if (!reviewerError && reviewer && typeof reviewer === 'object'
          && 'status' in reviewer && (reviewer.status === 'prepared' || reviewer.status === 'active')) {
          redirect(`/${lang}/pilot-reviewer`);
        }
      }
    }
  }

  return (
    <main dir={lang === 'fa' ? 'rtl' : 'ltr'} className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-4 pb-24 pt-32">
      <div className="w-full max-w-lg">
        {invitations.length ? (
          <WorkspaceInvitationContinuation lang={lang} invitations={invitations} />
        ) : (
          <Unavailable lang={lang} />
        )}
      </div>
    </main>
  );
}
