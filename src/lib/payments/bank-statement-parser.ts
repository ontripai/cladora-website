export type NormalizedBankStatementRow = {
  external_ref?: string | null;
  booked_on: string;
  value_on?: string | null;
  direction: 'credit' | 'debit';
  amount: number;
  currency: string;
  counterparty_name?: string | null;
  counterparty_iban_masked?: string | null;
  remittance_text?: string | null;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE');
  cells.push(value.trim());
  return cells;
}

function normalize(input: Record<string, unknown>): NormalizedBankStatementRow {
  const direction = String(input.direction ?? '').toLowerCase();
  if (direction !== 'credit' && direction !== 'debit') throw new Error('INVALID_DIRECTION');
  return {
    external_ref: input.external_ref ? String(input.external_ref) : null,
    booked_on: String(input.booked_on ?? ''),
    value_on: input.value_on ? String(input.value_on) : null,
    direction,
    amount: Number(input.amount),
    currency: String(input.currency ?? '').toUpperCase(),
    counterparty_name: input.counterparty_name ? String(input.counterparty_name) : null,
    counterparty_iban_masked: input.counterparty_iban_masked ? String(input.counterparty_iban_masked).toUpperCase() : null,
    remittance_text: input.remittance_text ? String(input.remittance_text) : null,
  };
}

export async function parseBankStatementFile(file: File): Promise<{ format: 'csv' | 'json'; rows: NormalizedBankStatementRow[] }> {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('INVALID_FILE_SIZE');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'json') throw new Error('UNSUPPORTED_STATEMENT_FORMAT');
  const text = await file.text();
  let rows: NormalizedBankStatementRow[];
  if (extension === 'json') {
    const decoded: unknown = JSON.parse(text);
    if (!Array.isArray(decoded)) throw new Error('INVALID_JSON_ROWS');
    rows = decoded.map((row) => normalize(row as Record<string, unknown>));
  } else {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('EMPTY_STATEMENT');
    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      return normalize(record);
    });
  }
  if (rows.length === 0 || rows.length > MAX_ROWS) throw new Error('INVALID_STATEMENT_ROW_COUNT');
  return { format: extension, rows };
}
