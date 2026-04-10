import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";

function splitCsvLine(line: string): string[] {
  // Very small CSV parser: supports comma/semicolon, no quoted commas.
  const sep = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(sep).map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

function asIsoDate(input: string): string | null {
  const s = input.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function mapGenericCsv(doc: RawDocument): RawTxnCandidate[] {
  const text = doc.rawText || "";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map(normalizeHeader);
  const hasHeader = header.some((h) => ["date", "data", "posted_at", "descricao", "description", "amount", "valor"].includes(h));

  const startIdx = hasHeader ? 1 : 0;
  const candidates: RawTxnCandidate[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    if (hasHeader) {
      for (let c = 0; c < header.length; c++) row[header[c] || `col_${c}`] = cols[c] ?? "";
    } else {
      for (let c = 0; c < cols.length; c++) row[`col_${c}`] = cols[c] ?? "";
    }

    const dateRaw = row.date || row.data || row.posted_at || row.col_0 || "";
    const postedAt = asIsoDate(dateRaw) || new Date().toISOString().slice(0, 10);
    const descriptionRaw = row.description || row.descricao || row.memo || row.col_1 || "";
    const amountRaw = row.amount || row.valor || row.value || row.col_2 || "";

    candidates.push({
      externalId: row.external_id || row.fitid || null,
      postedAt,
      descriptionRaw,
      transactionCode: row.transaction_code || row.code || null,
      amountRaw,
      amountRawSignHint: "unknown",
      metadata: { doc: doc.originalName, row },
    });
  }

  return candidates;
}

