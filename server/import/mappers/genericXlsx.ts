import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";

function asIsoDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function mapGenericXlsx(doc: RawDocument): RawTxnCandidate[] {
  const rows = doc.rows || [];
  const out: RawTxnCandidate[] = [];

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const postedAt =
      asIsoDate(row.date) ||
      asIsoDate(row.data) ||
      asIsoDate(row.posted_at) ||
      new Date().toISOString().slice(0, 10);

    const descriptionRaw =
      String(row.description ?? row.descricao ?? row.memo ?? "").trim();

    const amountRaw = String(row.amount ?? row.valor ?? row.value ?? "").trim();

    out.push({
      externalId: (row.external_id ?? row.fitid ?? null) as any,
      postedAt,
      descriptionRaw,
      transactionCode: (row.transaction_code ?? row.code ?? null) as any,
      amountRaw,
      amountRawSignHint: "unknown",
      metadata: { doc: doc.originalName, row },
    });
  }

  return out;
}

