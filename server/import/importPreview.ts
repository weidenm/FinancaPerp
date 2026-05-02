import type { RawTxnCandidate } from "../domain/ledger/types";

const UNMAPPED_WARNING_PT =
  "PDF, TXT ou imagem não geram lançamentos tabulares automaticamente nesta versão. Para gravar valores e datas na lista, exporte CSV, XLSX ou OFX do banco. O texto extraído ficou no ledger para revisão futura.";

export function buildImportPreviewMeta(candidates: RawTxnCandidate[]): {
  warnings: string[];
  autoCommitRecommended: boolean;
} {
  const hasStructuredRows = candidates.some((c) => c.transactionCode !== "UNMAPPED_TEXT");
  const hasUnmappedDocs = candidates.some((c) => c.transactionCode === "UNMAPPED_TEXT");

  const warnings: string[] = [];
  if (hasUnmappedDocs) warnings.push(UNMAPPED_WARNING_PT);

  return {
    warnings,
    autoCommitRecommended: hasStructuredRows,
  };
}
