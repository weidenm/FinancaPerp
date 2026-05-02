import type { AccountType, LedgerKind, SignConvention, SourceKind } from "../types";

export const LEDGER_RULE_VERSION_V1 = "ledger_rules@v1";

export interface RuleContext {
  accountType: AccountType;
  signConvention: SignConvention;
  sourceKind: SourceKind;
  connectorId: string;
}

export interface RuleSignals {
  description: string;
  transactionCode?: string | null;
  metadata: Record<string, unknown>;
}

export function classifyKindV1(ctx: RuleContext, s: RuleSignals): { kind: LedgerKind; affectsIncomeExpense: boolean } {
  const d = (s.description || "").toUpperCase();
  const code = (s.transactionCode || "").toUpperCase();

  const isRefund =
    d.includes("ESTORNO") ||
    d.includes("REFUND") ||
    d.includes("CHARGEBACK") ||
    d.includes("REVERS") ||
    code.includes("REVERS") ||
    code.includes("CHARGEBACK");

  if (isRefund) return { kind: "refund", affectsIncomeExpense: true };

  // Payment of credit card bill must never be an expense: treat as transfer.
  const isInvoicePayment =
    d.includes("PAGAMENTO FATURA") ||
    d.includes("PAGTO FATURA") ||
    d.includes("PAGAMENTO CARTAO") ||
    d.includes("PAGAMENTO CARTÃO") ||
    d.includes("CARD PAYMENT") ||
    code === "PAYMENT";

  if (isInvoicePayment) return { kind: "transfer", affectsIncomeExpense: false };

  // Internal movements between own accounts only. PIX/TED/DOC on statements are usually
  // payments to third parties and must flow to P&L (receita/despesa) unless clearly internal.
  const isInternalTransfer =
    code === "XFER" ||
    d.includes("TRANSFERENCIA ENTRE CONTAS") ||
    d.includes("TRANSFERÊNCIA ENTRE CONTAS") ||
    d.includes("TRANSFERENCIA ENTRE CC") ||
    d.includes("TRANSFERÊNCIA ENTRE CC") ||
    (d.includes("TRANSFER") && d.includes("MESMA TITULAR"));

  if (isInternalTransfer) return { kind: "transfer", affectsIncomeExpense: false };

  // For credit cards, default to purchase unless clearly something else.
  if (ctx.accountType === "credit_card") return { kind: "purchase", affectsIncomeExpense: true };

  // For checking/savings, purchases are common outflows.
  const isFee = d.includes("TARIFA") || d.includes("TAXA") || code.includes("FEE");
  if (isFee) return { kind: "fee", affectsIncomeExpense: false };

  const isInterest = d.includes("JUROS") || code.includes("INTEREST");
  if (isInterest) return { kind: "interest", affectsIncomeExpense: false };

  return { kind: "other", affectsIncomeExpense: true };
}

export function normalizeSignV1(params: {
  amount: number;
  amountRawSignHint: "positive" | "negative" | "unknown";
  ctx: RuleContext;
  kind: LedgerKind;
}): { amountNormalized: number; audit: Record<string, unknown> } {
  const { amount, amountRawSignHint, ctx, kind } = params;

  // Canonical: refund always positive.
  if (kind === "refund") {
    return { amountNormalized: Math.abs(amount), audit: { signRule: "refund_positive" } };
  }

  // If we were given a sign hint, respect it before convention inversion.
  let signed = amount;
  if (amountRawSignHint === "positive") signed = Math.abs(amount);
  if (amountRawSignHint === "negative") signed = -Math.abs(amount);

  // If we have no sign hint, derive from kind/account type.
  if (amountRawSignHint === "unknown") {
    if (kind === "purchase") signed = -Math.abs(amount);
    else if (kind === "transfer") signed = -Math.abs(amount);
    else if (kind === "fee" || kind === "interest") signed = -Math.abs(amount);
    else if (kind === "payment") signed = -Math.abs(amount);
  }

  // Apply account sign convention inversion when needed.
  if (ctx.signConvention === "inverted") {
    signed = -signed;
  }

  return {
    amountNormalized: signed,
    audit: {
      signRule: amountRawSignHint === "unknown" ? "derived_then_convention" : "hint_then_convention",
      signConvention: ctx.signConvention,
      amountRawSignHint,
      kind,
    },
  };
}

