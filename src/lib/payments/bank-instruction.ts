/**
 * Bank Payment Instruction & EPC QR Code Generator
 * Conforms to SEPA EPC069-12 Guidelines for Romanian/European Association Bank Transfers
 * Direct-to-Association: Beneficiary IBAN is always the building association's dedicated bank account.
 */

import { BankPaymentInstruction } from "./types";

export interface GenerateInstructionParams {
  associationLegalName: string;
  iban: string;
  bankName: string;
  amount: number;
  currency: string;
  clientReference: string;
  unitCode: string;
  debtorName?: string;
}

/**
 * Generate standard EPC QR (Quick Response Code) payload string
 * According to EPC069-12 European Payments Council specification.
 */
export function generateEpcQrPayload(params: {
  beneficiaryName: string;
  iban: string;
  amount: number;
  currency: string;
  reference: string;
}): string {
  const cleanIban = params.iban.replace(/\s+/g, "").toUpperCase();
  const cleanName = params.beneficiaryName.substring(0, 70).trim();
  const formattedAmount = `${params.currency.toUpperCase()}${params.amount.toFixed(2)}`;
  const cleanRef = params.reference.substring(0, 140).trim();

  // EPC069-12 Format:
  // 1: Service Tag (BCD)
  // 2: Version (002)
  // 3: Character Set (1 = UTF-8)
  // 4: Identification (SCT = SEPA Credit Transfer)
  // 5: BIC (optional)
  // 6: Beneficiary Name (max 70)
  // 7: Beneficiary IBAN
  // 8: Amount (e.g. RON150.00)
  // 9: Purpose code (optional, 4 chars)
  // 10: Structured Reference or Unstructured Remittance info
  // 11: Beneficiary to originator information (optional)
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    "", // BIC optional
    cleanName,
    cleanIban,
    formattedAmount,
    "", // Purpose code
    cleanRef,
    "CLADORA Direct Association Settlement"
  ].join("\n");
}

/**
 * Build complete BankPaymentInstruction object
 */
export function buildBankPaymentInstruction(params: GenerateInstructionParams): BankPaymentInstruction {
  const cleanIban = params.iban.replace(/\s+/g, "").toUpperCase();
  const formattedReference = `CLADORA-${params.unitCode}-${params.clientReference}`.toUpperCase();

  const epcPayload = generateEpcQrPayload({
    beneficiaryName: params.associationLegalName,
    iban: cleanIban,
    amount: params.amount,
    currency: params.currency || "RON",
    reference: formattedReference,
  });

  return {
    association_legal_name: params.associationLegalName,
    iban: cleanIban,
    bank_name: params.bankName,
    amount: params.amount,
    currency: params.currency || "RON",
    structured_reference: formattedReference,
    epc_qr_payload: epcPayload,
    unit_code: params.unitCode,
  };
}
