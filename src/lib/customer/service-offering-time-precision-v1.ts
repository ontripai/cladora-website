export const SERVICE_OFFERING_TIME_PRECISION_V1 =
  'service-offering-time-precision.v1' as const;

const instantPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

/** Parse the PostgreSQL timestamp facet without truncating its microseconds. */
export function parseServiceOfferingInstantMicrosV1(value: string): bigint | null {
  const match = instantPattern.exec(value);
  if (match === null) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    fractionText = '', zoneText] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText,
    hourText, minuteText, secondText].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23
    || minute > 59 || second > 59) return null;
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, 0);
  if (!Number.isFinite(local.getTime()) || local.getUTCFullYear() !== year
    || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day
    || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute
    || local.getUTCSeconds() !== second) return null;
  let offsetMinutes = 0;
  if (zoneText !== 'Z') {
    const offsetHour = Number(zoneText.slice(1, 3));
    const offsetMinute = Number(zoneText.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (zoneText[0] === '+' ? 1 : -1);
  }
  const fractionMicros = BigInt(fractionText.padEnd(6, '0'));
  return BigInt(local.getTime() - offsetMinutes * 60_000) * BigInt(1_000) + fractionMicros;
}

/** Start is inclusive; end is exclusive. Invalid or inverted facets fail closed. */
export function serviceOfferingTimeWindowAvailableV1(
  observedAt: string,
  validFrom: string,
  validUntil: string | null,
) {
  const observed = parseServiceOfferingInstantMicrosV1(observedAt);
  const start = parseServiceOfferingInstantMicrosV1(validFrom);
  const end = validUntil === null ? null : parseServiceOfferingInstantMicrosV1(validUntil);
  if (observed === null || start === null || (validUntil !== null && end === null)) return false;
  if (end !== null && end <= start) return false;
  return observed >= start && (end === null || observed < end);
}
