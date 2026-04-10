export type AccountType = "checking" | "savings" | "credit_card";
export type SignConvention = "natural" | "inverted";

export type SourceKind = "statement" | "card_invoice";

export type LedgerRuleVersion = string;

export type AmountSignHint = "positive" | "negative" | "unknown";

export type LedgerKind =
  | "purchase"
  | "payment"
  | "refund"
  | "transfer"
  | "fee"
  | "interest"
  | "other";

export type RawDocumentSource = "pdf" | "csv" | "xlsx" | "ofx" | "txt" | "image";

export interface RawDocument {
  source: RawDocumentSource;
  originalName: string;
  rawText?: string;
  rows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface RawTxnCandidate {
  externalId?: string | null;
  postedAt: string; // YYYY-MM-DD
  descriptionRaw: string;
  transactionCode?: string | null;
  amountRaw: string; // preserve as received (string)
  amountRawSignHint?: AmountSignHint;
  metadata: Record<string, unknown>;
}

export interface NormalizedLedgerTxn {
  postedAt: string;
  descriptionNormalized: string;
  amountRaw: string;
  amountNormalized: number; // signed canonical
  kind: LedgerKind;
  affectsIncomeExpense: boolean;
  transferGroupId?: string | null;
  confidence: number;
  needsReview: boolean;
  audit: Record<string, unknown>;
  fingerprint: string;
}

