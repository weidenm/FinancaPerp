import type { AccountType, LedgerKind, SignConvention, SourceKind } from "../types";
import { classifyKindV1, normalizeSignV1, type RuleContext, type RuleSignals } from "./v1";

export const LEDGER_RULE_VERSION_V2 = "ledger_rules@v2";

export interface RuleContextV2 extends RuleContext {
  /** When true, PIX/TED/DOC transfers are treated as real expenses/income instead of internal transfers. */
  treatPixAsExpense: boolean;
}

/**
 * v2 extends v1 with per-account PIX configuration.
 * If treatPixAsExpense=true, PIX/TED/DOC are NOT classified as transfer — they fall through
 * to "other" (checking/savings) or "purchase" (credit_card), which affectsIncomeExpense=true.
 */
export function classifyKindV2(
  ctx: RuleContextV2,
  s: RuleSignals,
): { kind: LedgerKind; affectsIncomeExpense: boolean } {
  const d = (s.description || "").toUpperCase();
  const code = (s.transactionCode || "").toUpperCase();

  // Refund always wins regardless of PIX setting
  const isRefund =
    d.includes("ESTORNO") ||
    d.includes("REFUND") ||
    d.includes("CHARGEBACK") ||
    d.includes("REVERS") ||
    code.includes("REVERS") ||
    code.includes("CHARGEBACK");

  if (isRefund) return { kind: "refund", affectsIncomeExpense: true };

  // Invoice payment is always a non-expense transfer
  const isInvoicePayment =
    d.includes("PAGAMENTO FATURA") ||
    d.includes("PAGTO FATURA") ||
    d.includes("PAGAMENTO CARTAO") ||
    d.includes("PAGAMENTO CARTÃO") ||
    d.includes("CARD PAYMENT") ||
    code.includes("PAYMENT");

  if (isInvoicePayment) return { kind: "transfer", affectsIncomeExpense: false };

  // PIX / TED / DOC: respect per-account setting
  const isPixLike =
    d.includes("PIX") ||
    d.includes("TED") ||
    d.includes("DOC") ||
    code.includes("TRANSFER");

  const isGenericTransfer = d.includes("TRANSFER") && !isPixLike;

  if (isGenericTransfer) return { kind: "transfer", affectsIncomeExpense: false };

  if (isPixLike) {
    if (ctx.treatPixAsExpense) {
      // Treat as a regular income/expense (kind stays "other")
      // Fall through to the generic classification below
    } else {
      return { kind: "transfer", affectsIncomeExpense: false };
    }
  }

  if (ctx.accountType === "credit_card") return { kind: "purchase", affectsIncomeExpense: true };

  const isFee = d.includes("TARIFA") || d.includes("TAXA") || code.includes("FEE");
  if (isFee) return { kind: "fee", affectsIncomeExpense: false };

  const isInterest = d.includes("JUROS") || code.includes("INTEREST");
  if (isInterest) return { kind: "interest", affectsIncomeExpense: false };

  return { kind: "other", affectsIncomeExpense: true };
}

export { normalizeSignV1 as normalizeSignV2 };
