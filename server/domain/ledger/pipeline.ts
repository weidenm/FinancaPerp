import type { RawTxnCandidate, NormalizedLedgerTxn } from "./types";
import { normalizeCandidateV1, normalizeCandidateV2 } from "./normalizer";
import { assignTransferGroups } from "./postings";
import { LEDGER_RULE_VERSION_V2 } from "./rules/v2";

interface PipelineParams {
  accountId: number;
  connectorId: string;
  accountType: "checking" | "savings" | "credit_card";
  signConvention: "natural" | "inverted";
  sourceKind: "statement" | "card_invoice";
  candidates: RawTxnCandidate[];
  treatPixAsExpense?: boolean;
  ruleVersion?: string;
}

export function normalizeCandidatesV1(params: PipelineParams): NormalizedLedgerTxn[] {
  const normalized = params.candidates.map((c) =>
    normalizeCandidateV1({
      accountId: params.accountId,
      connectorId: params.connectorId,
      accountType: params.accountType,
      signConvention: params.signConvention,
      sourceKind: params.sourceKind,
      candidate: c,
      treatPixAsExpense: params.treatPixAsExpense ?? false,
    }),
  );
  return assignTransferGroups(normalized);
}

export function normalizeCandidates(params: PipelineParams): NormalizedLedgerTxn[] {
  const useV2 = params.ruleVersion === LEDGER_RULE_VERSION_V2;
  const normalizer = useV2 ? normalizeCandidateV2 : normalizeCandidateV1;
  const normalized = params.candidates.map((c) =>
    normalizer({
      accountId: params.accountId,
      connectorId: params.connectorId,
      accountType: params.accountType,
      signConvention: params.signConvention,
      sourceKind: params.sourceKind,
      candidate: c,
      treatPixAsExpense: params.treatPixAsExpense ?? false,
    }),
  );
  return assignTransferGroups(normalized);
}

