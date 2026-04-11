import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";
import { normalizeHeader, isDateHeader, isDescHeader, isAmountHeader } from "../columnHints";
import { asIsoDateLoose } from "../dateParse";

export function mapGenericXlsx(doc: RawDocument): RawTxnCandidate[] {
  const rows = doc.rows || [];
  const out: RawTxnCandidate[] = [];

  for (const r of rows) {
    const row = r as Record<string, unknown>;

    let dateVal: unknown;
    let descVal: unknown;
    let amountVal: unknown;

    for (const [k, v] of Object.entries(row)) {
      const h = normalizeHeader(k);
      if (dateVal == null && isDateHeader(h)) dateVal = v;
      else if (descVal == null && isDescHeader(h)) descVal = v;
      else if (amountVal == null && isAmountHeader(h)) amountVal = v;
    }

    const postedParsed =
      asIsoDateLoose(dateVal) ||
      asIsoDateLoose(row.date) ||
      asIsoDateLoose(row.data) ||
      asIsoDateLoose(row.posted_at);
    const postedAt = postedParsed || new Date().toISOString().slice(0, 10);
    const dateInferred = postedParsed == null;

    const descriptionRaw =
      (descVal != null ? String(descVal) : "") ||
      String(row.description ?? row.descricao ?? row.memo ?? "").trim();

    const amountRaw =
      (amountVal != null ? String(amountVal) : "") ||
      String(row.amount ?? row.valor ?? row.value ?? "").trim();

    out.push({
      externalId: (row.external_id ?? row.fitid ?? null) as any,
      postedAt,
      descriptionRaw,
      transactionCode: (row.transaction_code ?? row.code ?? null) as any,
      amountRaw,
      amountRawSignHint: "unknown",
      metadata: { doc: doc.originalName, row, dateInferred },
    });
  }

  return out;
}
