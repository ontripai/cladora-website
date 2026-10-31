import { handleValuationReadV1 } from '@/lib/airprop/valuation-read-v1';

// Source transport only. No trusted runtime producer/action grant is installed.
// Do NOT substitute underwriting assumptions, demo JSON, client authority or a
// guessed Core RPC. Default stays NOT_READY until independently reviewed binding.
export const runtime='nodejs';
export async function GET(request:Request){return handleValuationReadV1(request);}
