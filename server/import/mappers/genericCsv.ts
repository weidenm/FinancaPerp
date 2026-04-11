import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";
import {
  normalizeHeader,
  isDateHeader,
  isDescHeader,
  isAmountHeader,
} from "../columnHints";
import { asIsoDateFromString } from "../dateParse";

/** Split on `sep` outside of double quotes. */
export function splitCsvLineWithSep(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Prefer `;` when it yields more columns than `,` (typical BR CSV with decimal commas). */
export function detectCsvDelimiter(sampleLines: string[]): ";" | "," {
  if (sampleLines.length === 0) return ",";
  const countsSemi = sampleLines.map((l) => splitCsvLineWithSep(l, ";").length);
  const countsComma = sampleLines.map((l) => splitCsvLineWithSep(l, ",").length);
  const medSemi = median(countsSemi);
  const medComma = median(countsComma);
  if (medSemi > medComma) return ";";
  if (medComma > medSemi) return ",";
  const first = sampleLines[0];
  const nSemi = (first.match(/;/g) || []).length;
  const nComma = (first.match(/,/g) || []).length;
  if (nSemi > nComma) return ";";
  return ",";
}

function headerLooksLikeDataRow(cols: string[]): boolean {
  if (cols.length === 0) return false;
  const first = cols[0]?.trim() ?? "";
  if (asIsoDateFromString(first)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(first)) return true;
  if (/^-?\d+[.,]\d{2}$/.test(first.replace(/\./g, "").replace(",", "."))) return false;
  return false;
}

function rowLooksLikeHeader(cols: string[]): boolean {
  if (cols.length < 2) return false;
  if (headerLooksLikeDataRow(cols)) return false;
  const joined = cols.join(" ").toLowerCase();
  const hints =
    /data|date|valor|amount|desc|histor|lanç|lancamento|memo|credito|cr[eé]dito|d[eé]bito|fitid/i.test(
      joined,
    );
  return hints;
}

function findColumnIndexBy(headersNorm: string[], pred: (h: string) => boolean): number {
  return headersNorm.findIndex(pred);
}

function cellFromRow(row: Record<string, string>, colIdx: number, headersNorm: string[]): string {
  if (colIdx >= 0 && colIdx < headersNorm.length) {
    const key = headersNorm[colIdx];
    if (key && row[key] !== undefined) return row[key] ?? "";
  }
  return "";
}

export function mapGenericCsv(doc: RawDocument): RawTxnCandidate[] {
  const text = doc.rawText || "";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const sample = lines.slice(0, Math.min(8, lines.length));
  const sep = detectCsvDelimiter(sample);

  const firstCols = splitCsvLineWithSep(lines[0], sep);
  const hasHeader = rowLooksLikeHeader(firstCols);
  const startIdx = hasHeader ? 1 : 0;

  const headersNorm = hasHeader ? firstCols.map(normalizeHeader) : [];

  const dateIdx = hasHeader ? findColumnIndexBy(headersNorm, isDateHeader) : 0;
  const descIdx = hasHeader ? findColumnIndexBy(headersNorm, isDescHeader) : 1;
  const amountIdx = hasHeader ? findColumnIndexBy(headersNorm, isAmountHeader) : 2;

  const candidates: RawTxnCandidate[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLineWithSep(lines[i], sep);
    const row: Record<string, string> = {};
    if (hasHeader) {
      for (let c = 0; c < headersNorm.length; c++) {
        const key = headersNorm[c] || `col_${c}`;
        row[key] = cols[c] ?? "";
      }
    } else {
      for (let c = 0; c < cols.length; c++) row[`col_${c}`] = cols[c] ?? "";
    }

    const dateRaw = hasHeader
      ? cellFromRow(row, dateIdx, headersNorm) || row.col_0 || ""
      : row.col_0 || "";
    const postedParsed = asIsoDateFromString(dateRaw);
    const postedAt = postedParsed || new Date().toISOString().slice(0, 10);
    const dateInferred = postedParsed == null;

    const descriptionRaw = hasHeader
      ? (descIdx >= 0 ? cellFromRow(row, descIdx, headersNorm) : "") ||
        row.description ||
        row.descricao ||
        row.memo ||
        row.col_1 ||
        ""
      : row.col_1 || "";

    const amountRaw = hasHeader
      ? (amountIdx >= 0 ? cellFromRow(row, amountIdx, headersNorm) : "") ||
        row.amount ||
        row.valor ||
        row.value ||
        row.col_2 ||
        ""
      : row.col_2 || "";

    candidates.push({
      externalId: row.external_id || row.fitid || null,
      postedAt,
      descriptionRaw,
      transactionCode: row.transaction_code || row.code || null,
      amountRaw,
      amountRawSignHint: "unknown",
      metadata: { doc: doc.originalName, row, dateInferred, csvDelimiter: sep },
    });
  }

  return candidates;
}
