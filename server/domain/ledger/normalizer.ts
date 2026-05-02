import crypto from "node:crypto";
import type { RawTxnCandidate, NormalizedLedgerTxn } from "./types";
import { classifyKindV1, LEDGER_RULE_VERSION_V1, normalizeSignV1, type RuleContext } from "./rules/v1";

function normalizeDescription(input: string): string {
  return (input || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAmountLoose(amountRaw: string): number | null {
  const s = (amountRaw || "").trim();
  if (!s) return null;

  // Support "1.234,56" and "1234.56" and "-123,45"
  const cleaned = s
    .replace(/[^\d,.\-+]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, ""); // remove thousands dots

  const hasComma = cleaned.includes(",");
  const normalized = hasComma ? cleaned.replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function fingerprintCandidate(input: {
  accountId: number;
  postedAt: string;
  amountNormalized: number;
  descriptionNormalized: string;
  transactionCode?: string | null;
  externalId?: string | null;
}): string {
  const base = [
    input.accountId,
    input.postedAt,
    input.amountNormalized.toFixed(2),
    input.descriptionNormalized.toUpperCase(),
    input.transactionCode || "",
    input.externalId || "",
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

export function normalizeCandidateV1(params: {
  accountId: number;
  connectorId: string;
  accountType: "checking" | "savings" | "credit_card";
  signConvention: "natural" | "inverted";
  sourceKind: "statement" | "card_invoice";
  candidate: RawTxnCandidate;
}): NormalizedLedgerTxn {
  const { candidate } = params;

  const amountParsed = parseAmountLoose(candidate.amountRaw);
  const descriptionNormalized = normalizeDescription(candidate.descriptionRaw);

  const isUnmappedDocument =
    candidate.transactionCode === "UNMAPPED_TEXT" ||
    candidate.metadata?.note === "unmapped_text_document";

  const ctx: RuleContext = {
    accountType: params.accountType,
    signConvention: params.signConvention,
    sourceKind: params.sourceKind,
    connectorId: params.connectorId,
  };

  const classified = classifyKindV1(ctx, {
    description: descriptionNormalized,
    transactionCode: candidate.transactionCode,
    metadata: candidate.metadata,
  });

  const amountBase = amountParsed ?? 0;
  const sign = normalizeSignV1({
    amount: amountBase,
    amountRawSignHint: candidate.amountRawSignHint || "unknown",
    ctx,
    kind: classified.kind,
  });

  const needsReview =
    amountParsed === null || descriptionNormalized.length === 0 || isUnmappedDocument;

  const audit = {
    ruleVersion: LEDGER_RULE_VERSION_V1,
    classified,
    sign: sign.audit,
    amountParsed,
    ...(isUnmappedDocument ? { unmappedDocument: true as const } : {}),
  };

  const fingerprint = fingerprintCandidate({
    accountId: params.accountId,
    postedAt: candidate.postedAt,
    amountNormalized: sign.amountNormalized,
    descriptionNormalized,
    transactionCode: candidate.transactionCode,
    externalId: candidate.externalId,
  });

  return {
    postedAt: candidate.postedAt,
    descriptionNormalized,
    amountRaw: candidate.amountRaw,
    amountNormalized: sign.amountNormalized,
    kind: classified.kind,
    affectsIncomeExpense: classified.affectsIncomeExpense,
    confidence: isUnmappedDocument ? 0.05 : needsReview ? 0.2 : 0.7,
    needsReview,
    audit,
    fingerprint,
  };
}

