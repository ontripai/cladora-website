const SUPPORTED_SOURCE_STATUSES = new Set([
  'regular',
  'special',
  'macroregion',
  'deprecated',
  'reserved',
  'private_use',
  'unknown',
]);

export const CLDR_REGION_PARSER_VERSION = 'core-cldr-region-validity-parser.v1';
export const CLDR_REGION_FILTER_POLICY_VERSION =
  'core-country-territory-region-filter.v1';
export const EXCEPTIONAL_REGULAR_CODES = Object.freeze(['XK']);

function decodeFixedWidth(value, kind) {
  if (kind === 'numeric') return Number.parseInt(value, 10);
  return [...value].reduce((result, character) =>
    (result * 26) + character.charCodeAt(0) - 65, 0);
}

function encodeFixedWidth(value, width, kind) {
  if (kind === 'numeric') return String(value).padStart(width, '0');
  let remaining = value;
  const output = Array(width).fill('A');
  for (let index = width - 1; index >= 0; index -= 1) {
    output[index] = String.fromCharCode(65 + (remaining % 26));
    remaining = Math.floor(remaining / 26);
  }
  if (remaining !== 0) throw new Error('CLDR_REGION_RANGE_OVERFLOW');
  return output.join('');
}

export function expandCldrRegionToken(token) {
  if (!token.includes('~')) return [token];
  const parts = token.split('~');
  if (parts.length !== 2 || parts.some(part => part.length === 0)) {
    throw new Error('CLDR_REGION_RANGE_INVALID');
  }
  const [start, endSuffix] = parts;
  if (endSuffix.length > start.length) throw new Error('CLDR_REGION_RANGE_INVALID');
  const end = `${start.slice(0, start.length - endSuffix.length)}${endSuffix}`;
  const kind = /^\d+$/.test(start) && /^\d+$/.test(end)
    ? 'numeric'
    : /^[A-Z]+$/.test(start) && /^[A-Z]+$/.test(end)
      ? 'alpha'
      : null;
  if (!kind || start.length !== end.length) throw new Error('CLDR_REGION_RANGE_INVALID');
  const first = decodeFixedWidth(start, kind);
  const last = decodeFixedWidth(end, kind);
  if (last < first || last - first > 1000) throw new Error('CLDR_REGION_RANGE_INVALID');
  return Array.from({ length: last - first + 1 }, (_, offset) =>
    encodeFixedWidth(first + offset, start.length, kind));
}

export function parseCldrRegionValidity(xml) {
  if (typeof xml !== 'string' || !xml.includes("<id type='region'")) {
    throw new Error('CLDR_REGION_SOURCE_INVALID');
  }
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, ' ');
  const expression = /<id\s+type=['"]region['"]\s+idStatus=['"]([^'"]+)['"]>([\s\S]*?)<\/id>/g;
  const records = [];
  const seen = new Set();
  let match;
  while ((match = expression.exec(withoutComments)) !== null) {
    const sourceStatus = match[1];
    if (!SUPPORTED_SOURCE_STATUSES.has(sourceStatus)) {
      throw new Error('CLDR_REGION_STATUS_UNKNOWN');
    }
    const tokens = match[2].trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      for (const code of expandCldrRegionToken(token)) {
        if (!/^(?:[A-Z]{2}|\d{3})$/.test(code)) {
          throw new Error('CLDR_REGION_CODE_INVALID');
        }
        if (seen.has(code)) throw new Error('CLDR_REGION_CODE_DUPLICATE');
        seen.add(code);
        records.push(Object.freeze({ code, source_status: sourceStatus }));
      }
    }
  }
  if (records.length === 0) throw new Error('CLDR_REGION_SOURCE_EMPTY');
  return Object.freeze(records);
}

export function applyCountryTerritoryFilter(record) {
  const exceptionalRegular = EXCEPTIONAL_REGULAR_CODES.includes(record.code);
  if (record.source_status === 'regular' && /^[A-Z]{2}$/.test(record.code)) {
    return Object.freeze({
      ...record,
      registry_entry_status: 'active',
      new_assignment: 'allowed',
      exceptional_regular: exceptionalRegular,
      governance_decision: exceptionalRegular
        ? 'technical_interoperability_without_political_or_legal_meaning'
        : null,
    });
  }
  if (record.source_status === 'deprecated' && /^[A-Z]{2}$/.test(record.code)) {
    return Object.freeze({
      ...record,
      registry_entry_status: 'historical',
      new_assignment: 'rejected',
      exceptional_regular: false,
      governance_decision: null,
    });
  }
  return Object.freeze({
    ...record,
    registry_entry_status: 'excluded',
    new_assignment: 'rejected',
    exceptional_regular: false,
    governance_decision: null,
  });
}

export function normalizeCldrRegionValidity(records) {
  const header = [
    'core-country-territory-region-validity.normalized.v1',
    `parser=${CLDR_REGION_PARSER_VERSION}`,
    `filter=${CLDR_REGION_FILTER_POLICY_VERSION}`,
  ];
  const lines = records
    .map(applyCountryTerritoryFilter)
    .sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)
      || (left.source_status < right.source_status
        ? -1 : left.source_status > right.source_status ? 1 : 0))
    .map(record => [
      record.code,
      record.source_status,
      record.registry_entry_status,
      record.new_assignment,
      record.exceptional_regular ? 'exceptional_regular' : '-',
      record.governance_decision ?? '-',
    ].join('\t'));
  return `${[...header, ...lines].join('\n')}\n`;
}
