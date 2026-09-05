import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface LeadNotificationPayload {
  referenceId: string;
  leadType: 'contact' | 'pilot';
  fullName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  buildingType?: string | null;
  unitsCount?: number | null;
  currentSoftware?: string | null;
  city?: string | null;
  county?: string | null;
  message?: string | null;
  locale: string;
  createdAt: string;
  sourcePage?: string | null;
}

export interface NotificationResult {
  status: 'sent' | 'skipped_no_config' | 'failed';
  attemptedAt: string;
  errorCode?: string;
}

/**
 * Validates whether an IPv4 address is in a private, loopback, link-local, or special reserved range.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed is unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Validates whether an IPv6 address is loopback, unique-local, link-local, or mapped private IPv4.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // :: (Unspecified)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
  // fe80::/10 (Link-Local)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // fc00::/7 (Unique Local Address)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.substring(7);
    if (isIP(v4) === 4) {
      return isPrivateOrReservedIPv4(v4);
    }
    return true;
  }

  return false;
}

/**
 * Validates that a string does not contain CR/LF or control characters (header injection protection).
 */
export function isSafeHeaderValue(val: string): boolean {
  return !/[\r\n\x00-\x1F]/.test(val);
}

export interface DnsLookupEntry {
  address: string;
  family: number;
}

export type DnsLookupFunction = (hostname: string) => Promise<DnsLookupEntry[]>;

export interface ValidateWebhookOptions {
  allowedHostsEnv?: string;
  lookupImpl?: DnsLookupFunction;
  signal?: AbortSignal;
}

export interface NotifyLeadOptions {
  fetchImpl?: typeof fetch;
  lookupImpl?: DnsLookupFunction;
  timeoutMs?: number;
  allowedHostsEnv?: string;
}

/**
 * Validates a webhook destination URL against strict SSRF rules:
 * - Primary defense: Mandatory Exact Host Allowlist (CONTACT_NOTIFICATION_ALLOWED_HOSTS)
 *   (Note: DNS pre-lookup does not definitively stop DNS rebinding because fetch re-resolves;
 *    security is strictly rooted in the exact host allowlist).
 * - Enforces HTTPS protocol
 * - Disallows credentials in URL (user:pass)
 * - Restricts non-standard ports to development/test environments
 * - Disallows wildcard (*) or suffix matches in the allowlist
 * - Secondary defense-in-depth: Blocks localhost, internal domains, cloud metadata endpoints
 * - Resolves DNS and blocks private/loopback/link-local IPs (bound to deadline signal)
 */
export async function validateWebhookDestination(
  urlStr: string,
  optionsOrAllowedHosts?: string | ValidateWebhookOptions
): Promise<{ valid: boolean; reason?: string; url?: URL }> {
  let allowedHostsEnv: string | undefined;
  let lookupImpl: DnsLookupFunction | undefined;
  let signal: AbortSignal | undefined;

  if (typeof optionsOrAllowedHosts === 'string') {
    allowedHostsEnv = optionsOrAllowedHosts;
  } else if (optionsOrAllowedHosts) {
    allowedHostsEnv = optionsOrAllowedHosts.allowedHostsEnv;
    lookupImpl = optionsOrAllowedHosts.lookupImpl;
    signal = optionsOrAllowedHosts.signal;
  }

  let destination: URL;
  try {
    destination = new URL(urlStr);
  } catch {
    return { valid: false, reason: 'INVALID_URL' };
  }

  // 1. Mandatory HTTPS protocol
  if (destination.protocol !== 'https:') {
    return { valid: false, reason: 'NON_HTTPS_PROTOCOL' };
  }

  // 2. Reject credentials in URL
  if (destination.username || destination.password) {
    return { valid: false, reason: 'CREDENTIALS_IN_URL' };
  }

  // 3. Port check: Non-standard port (not 443) only permitted in dev/test
  if (destination.port && destination.port !== '443') {
    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (!isDevOrTest) {
      return { valid: false, reason: 'NON_STANDARD_PORT' };
    }
  }

  const hostname = destination.hostname.toLowerCase().trim();

  // 4. Mandatory Exact Host Allowlist
  const allowedHostsConfig = (allowedHostsEnv ?? process.env.CONTACT_NOTIFICATION_ALLOWED_HOSTS)?.trim();
  if (!allowedHostsConfig) {
    return { valid: false, reason: 'MISSING_ALLOWLIST' };
  }

  const allowedList = allowedHostsConfig
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (allowedList.length === 0) {
    return { valid: false, reason: 'MISSING_ALLOWLIST' };
  }

  // Exact match only: reject wildcard or suffix matches
  const isExactMatch = allowedList.some((allowed) => {
    if (allowed.includes('*') || allowed.startsWith('.')) return false;
    return allowed === hostname;
  });

  if (!isExactMatch) {
    return { valid: false, reason: 'HOSTNAME_NOT_IN_ALLOWLIST' };
  }

  // 5. Reject obvious private hostnames and cloud metadata endpoints (defense-in-depth)
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa') ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { valid: false, reason: 'PRIVATE_OR_METADATA_HOSTNAME' };
  }

  // 6. IP address evaluation (literal or via DNS lookup as defense-in-depth)
  const ipFamily = isIP(hostname);
  if (ipFamily === 4) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return { valid: false, reason: 'PRIVATE_IPV4_ADDRESS' };
    }
  } else if (ipFamily === 6) {
    if (isPrivateOrReservedIPv6(hostname)) {
      return { valid: false, reason: 'PRIVATE_IPV6_ADDRESS' };
    }
  } else {
    if (signal?.aborted) {
      return { valid: false, reason: 'TIMEOUT' };
    }

    // Domain name: resolve DNS and verify all returned addresses with signal deadline
    const resolver = lookupImpl ?? ((h: string) => lookup(h, { all: true }));
    try {
      let addresses: DnsLookupEntry[];
      if (signal) {
        addresses = await new Promise<DnsLookupEntry[]>((resolve, reject) => {
          const onAbort = () => {
            const err = new Error('DNS lookup timed out');
            err.name = 'AbortError';
            reject(err);
          };
          signal.addEventListener('abort', onAbort, { once: true });
          resolver(hostname)
            .then((res) => {
              signal.removeEventListener('abort', onAbort);
              resolve(res);
            })
            .catch((err) => {
              signal.removeEventListener('abort', onAbort);
              reject(err);
            });
        });
      } else {
        addresses = await resolver(hostname);
      }

      if (!addresses || addresses.length === 0) {
        return { valid: false, reason: 'DNS_RESOLUTION_EMPTY' };
      }

      for (const entry of addresses) {
        if (entry.family === 4 && isPrivateOrReservedIPv4(entry.address)) {
          return { valid: false, reason: `DNS_RESOLVED_PRIVATE_IPV4: ${entry.address}` };
        }
        if (entry.family === 6 && isPrivateOrReservedIPv6(entry.address)) {
          return { valid: false, reason: `DNS_RESOLVED_PRIVATE_IPV6: ${entry.address}` };
        }
      }
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout')))) {
        return { valid: false, reason: 'TIMEOUT' };
      }
      return { valid: false, reason: 'DNS_RESOLUTION_FAILED' };
    }
  }

  return { valid: true, url: destination };
}

/**
 * Dispatches a secure server-side lead notification.
 * 1. Reads destination strictly from server environment (prevents SSRF).
 * 2. Never throws: failure is captured and technical status is logged without PII.
 * 3. Enforces HTTPS, 2.5s overall timeout (covering validation, DNS, and fetch), redirect: 'error', exact host allowlist, and private IP blocking.
 * 4. Guaranteed timeout cleanup in finally block.
 * 5. Supports dependency injection (fetchImpl, lookupImpl) for automated unit testing.
 */
export async function notifyNewLead(
  payload: LeadNotificationPayload,
  options?: NotifyLeadOptions
): Promise<NotificationResult> {
  const attemptedAt = new Date().toISOString();
  const webhookUrl = process.env.CONTACT_NOTIFICATION_WEBHOOK_URL?.trim();

  // If no notification endpoint configured: log non-sensitive metadata only
  if (!webhookUrl) {
    console.info('[LEAD_NOTIFICATION_SKIPPED]', {
      referenceId: payload.referenceId,
      leadType: payload.leadType,
      locale: payload.locale,
      status: 'no_notification_channel_configured',
    });
    return { status: 'skipped_no_config', attemptedAt };
  }

  const timeoutDuration = options?.timeoutMs ?? 2500;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

  try {
    // 1. SSRF & Allowlist Protection (DNS lookup covered by overall controller.signal deadline)
    const validation = await validateWebhookDestination(webhookUrl, {
      allowedHostsEnv: options?.allowedHostsEnv,
      lookupImpl: options?.lookupImpl,
      signal: controller.signal,
    });

    if (!validation.valid || !validation.url) {
      if (validation.reason === 'TIMEOUT') {
        console.error('[LEAD_NOTIFICATION_ERROR] Validation/DNS timeout', {
          referenceId: payload.referenceId,
          error: 'TIMEOUT',
        });
        return { status: 'failed', attemptedAt, errorCode: 'TIMEOUT' };
      }

      console.error('[LEAD_NOTIFICATION_SSRF_BLOCKED]', {
        referenceId: payload.referenceId,
        reason: validation.reason,
      });
      return { status: 'failed', attemptedAt, errorCode: `SSRF_BLOCKED_${validation.reason}` };
    }

    const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();
    if (apiKey && !isSafeHeaderValue(apiKey)) {
      console.error('[LEAD_NOTIFICATION_ERROR] Malformed API key contains illegal header characters.', {
        referenceId: payload.referenceId,
      });
      return { status: 'failed', attemptedAt, errorCode: 'INVALID_HEADER_VALUE' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CLADORA-Lead-Notifier/1.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.replace(/[\r\n]/g, '').trim()}`;
    }

    const fetcher = options?.fetchImpl ?? fetch;

    const response = await fetcher(validation.url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'marketing_lead.created',
        referenceId: payload.referenceId,
        leadType: payload.leadType,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone ?? null,
        role: payload.role ?? null,
        buildingType: payload.buildingType ?? null,
        unitsCount: payload.unitsCount ?? null,
        currentSoftware: payload.currentSoftware ?? null,
        city: payload.city ?? null,
        county: payload.county ?? null,
        message: payload.message ?? null,
        locale: payload.locale,
        createdAt: payload.createdAt,
        sourcePage: payload.sourcePage ?? null,
      }),
      redirect: 'error', // Prevent SSRF via HTTP redirects
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('[LEAD_NOTIFICATION_FAILED]', {
        referenceId: payload.referenceId,
        statusCode: response.status,
      });
      return {
        status: 'failed',
        attemptedAt,
        errorCode: `HTTP_${response.status}`,
      };
    }

    console.info('[LEAD_NOTIFICATION_SENT]', {
      referenceId: payload.referenceId,
      leadType: payload.leadType,
    });

    return { status: 'sent', attemptedAt };
  } catch (err: unknown) {
    const isTimeout =
      controller.signal.aborted ||
      (err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')));
    console.error('[LEAD_NOTIFICATION_ERROR]', {
      referenceId: payload.referenceId,
      error: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
    });
    return {
      status: 'failed',
      attemptedAt,
      errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
