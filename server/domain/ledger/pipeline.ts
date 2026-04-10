import type { RawTxnCandidate, NormalizedLedgerTxn } from "./types";
import { normalizeCandidateV1 } from "./normalizer";
import { assignTransferGroups } from "./postings";

export function normalizeCandidatesV1(params: {
  accountId: number;
  connectorId: string;
  accountType: "checking" | "savings" | "credit_card";
  signConvention: "natural" | "inverted";
  sourceKind: "statement" | "card_invoice";
  candidates: RawTxnCandidate[];
}): NormalizedLedgerTxn[] {
  const normalized = params.candidates.map((c) =>
    normalizeCandidateV1({
      accountId: params.accountId,
      connectorId: params.connectorId,
      accountType: params.accountType,
      signConvention: params.signConvention,
      sourceKind: params.sourceKind,
      candidate: c,
    }),
  );

  return assignTransferGroups(normalized);
}

