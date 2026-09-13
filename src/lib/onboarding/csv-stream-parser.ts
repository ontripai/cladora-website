export const IMPORT_LIMITS = { bytes: 20 * 1024 * 1024, rows: 100_000, columns: 128, cellChars: 32_768 } as const;

export function parseBoundedCsv(input: string): Record<string, string>[] {
  if (Buffer.byteLength(input, "utf8") > IMPORT_LIMITS.bytes) throw new Error("IMPORT_FILE_TOO_LARGE");
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ",") { record.push(cell); cell = ""; }
    else if (ch === "\n") { record.push(cell.replace(/\r$/, "")); records.push(record); record = []; cell = ""; }
    else cell += ch;
    if (cell.length > IMPORT_LIMITS.cellChars) throw new Error("IMPORT_CELL_TOO_LARGE");
  }
  if (quoted) throw new Error("IMPORT_UNCLOSED_QUOTE");
  if (cell.length || record.length) { record.push(cell.replace(/\r$/, "")); records.push(record); }
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length < 2) throw new Error("IMPORT_ROWS_REQUIRED");
  if (nonEmpty.length - 1 > IMPORT_LIMITS.rows) throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  if (headers.length > IMPORT_LIMITS.columns || headers.some((h) => !h) || new Set(headers).size !== headers.length) throw new Error("IMPORT_HEADERS_INVALID");
  return nonEmpty.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, escapeFormula(values[i] ?? "")])));
}

export function escapeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
