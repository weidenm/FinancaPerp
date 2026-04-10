import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";
import { mapGenericCsv } from "./genericCsv";
import { mapGenericXlsx } from "./genericXlsx";
import { mapGenericOfx } from "./genericOfx";

export function mapDocumentsToCandidates(params: {
  connectorId: string;
  docs: RawDocument[];
}): RawTxnCandidate[] {
  // For now, route by document source. connectorId is reserved for future connector-specific mapping.
  const out: RawTxnCandidate[] = [];

  for (const doc of params.docs) {
    if (doc.source === "csv") out.push(...mapGenericCsv(doc));
    else if (doc.source === "xlsx") out.push(...mapGenericXlsx(doc));
    else if (doc.source === "ofx") out.push(...mapGenericOfx(doc));
    else if (doc.source === "txt" || doc.source === "pdf" || doc.source === "image") {
      // Text/PDF/Image OCR: without a connector-specific template, we can't reliably split into transactions.
      // Keep a single candidate for manual review.
      out.push({
        externalId: null,
        postedAt: new Date().toISOString().slice(0, 10),
        descriptionRaw: (doc.rawText || "").slice(0, 5120),
        transactionCode: "UNMAPPED_TEXT",
        amountRaw: "0",
        amountRawSignHint: "unknown",
        metadata: { doc: doc.originalName, source: doc.source, note: "unmapped_text_document" },
      });
    }
  }

  return out;
}

