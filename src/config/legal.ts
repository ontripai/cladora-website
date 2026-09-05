import { Language } from '@/types';

export const LEGAL_DOC_LAST_UPDATED_ISO = '2026-09-05';

export interface LegalCompanyConfig {
  companyName: string | null;
  cui: string | null;
  tradeRegisterNumber: string | null;
  registeredAddress: string | null;
  privacyEmail: string;
  supportEmail: string;
  dpoContact: string | null;
  retentionPeriodYears: number;
}

export const LEGAL_CONFIG: LegalCompanyConfig = {
  companyName: process.env.LEGAL_COMPANY_NAME || null,
  cui: process.env.LEGAL_CUI || null,
  tradeRegisterNumber: process.env.LEGAL_TRADE_REGISTER_NUMBER || null,
  registeredAddress: process.env.LEGAL_REGISTERED_ADDRESS || null,
  privacyEmail: 'privacy@cladora.ro',
  supportEmail: 'contact@cladora.ro',
  dpoContact: process.env.LEGAL_DPO_CONTACT || null,
  retentionPeriodYears: 5,
};

/**
 * Returns a human-friendly, localized string of the document's last update date.
 * Uses official ECMAScript Intl formatters (including Solar Hijri calendar for Persian).
 */
export function getLegalDocumentDate(lang: Language): string {
  const dateObj = new Date(`${LEGAL_DOC_LAST_UPDATED_ISO}T12:00:00Z`);
  switch (lang) {
    case 'ro':
      return new Intl.DateTimeFormat('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
    case 'fa':
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
    case 'en':
    default:
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
  }
}

/**
 * Returns a claim-safe corporate identity string without displaying raw brackets.
 */
export function getLegalOperatorName(lang: Language): string {
  if (LEGAL_CONFIG.companyName) {
    return LEGAL_CONFIG.companyName;
  }

  switch (lang) {
    case 'ro':
      return 'Operatorul Platformei CLADORA';
    case 'fa':
      return 'مجری فنی پلتفرم کلادورا';
    case 'en':
    default:
      return 'CLADORA Platform Operator';
  }
}
