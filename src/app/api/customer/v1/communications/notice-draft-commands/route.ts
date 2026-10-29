import { createClient } from "@/lib/supabase/server";
import { handleNoticeDraftRequest, type NoticeDraftApiClient } from "@/lib/customer/notice-draft-api";

export const runtime = "nodejs";
// Explicit durable endpoint, no mode inference or delegation to legacy notices.
const userClient = async () => await createClient() as unknown as NoticeDraftApiClient;
export async function GET(request: Request) { return handleNoticeDraftRequest(request, userClient); }
export async function POST(request: Request) { return handleNoticeDraftRequest(request, userClient); }
