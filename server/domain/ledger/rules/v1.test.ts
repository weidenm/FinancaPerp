import { describe, it, expect } from "vitest";
import { classifyKindV1, normalizeSignV1, LEDGER_RULE_VERSION_V1 } from "./v1";

const baseCtx = {
  accountType: "checking" as const,
  signConvention: "natural" as const,
  sourceKind: "statement" as const,
  connectorId: "generic_csv",
};

const creditCtx = { ...baseCtx, accountType: "credit_card" as const };
const invertedCtx = { ...baseCtx, signConvention: "inverted" as const };

describe("classifyKindV1", () => {
  it("classifies ESTORNO as refund", () => {
    const r = classifyKindV1(baseCtx, { description: "ESTORNO COMPRA", metadata: {} });
    expect(r.kind).toBe("refund");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("classifies CHARGEBACK via code as refund", () => {
    const r = classifyKindV1(baseCtx, { description: "TXN001", transactionCode: "CHARGEBACK", metadata: {} });
    expect(r.kind).toBe("refund");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("classifies PAGAMENTO FATURA as transfer (not expense)", () => {
    const r = classifyKindV1(baseCtx, { description: "PAGAMENTO FATURA NUBANK", metadata: {} });
    expect(r.kind).toBe("transfer");
    expect(r.affectsIncomeExpense).toBe(false);
  });

  it("classifies PIX as outflow in P&L (not internal transfer)", () => {
    const r = classifyKindV1(baseCtx, { description: "PIX ENVIADO JOAO", metadata: {} });
    expect(r.kind).toBe("other");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("classifies TED to third party as P&L", () => {
    const r = classifyKindV1(baseCtx, { description: "TED PARA BANCO", metadata: {} });
    expect(r.kind).toBe("other");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("classifies OFX XFER as internal transfer", () => {
    const r = classifyKindV1(baseCtx, { description: "MOVIMENTO", transactionCode: "XFER", metadata: {} });
    expect(r.kind).toBe("transfer");
    expect(r.affectsIncomeExpense).toBe(false);
  });

  it("classifies transfer between own accounts by description", () => {
    const r = classifyKindV1(baseCtx, {
      description: "TRANSFERENCIA ENTRE CONTAS POUPANCA",
      metadata: {},
    });
    expect(r.kind).toBe("transfer");
    expect(r.affectsIncomeExpense).toBe(false);
  });

  it("classifies TARIFA as fee (not income/expense)", () => {
    const r = classifyKindV1(baseCtx, { description: "TARIFA MENSAL CONTA", metadata: {} });
    expect(r.kind).toBe("fee");
    expect(r.affectsIncomeExpense).toBe(false);
  });

  it("classifies JUROS as interest", () => {
    const r = classifyKindV1(baseCtx, { description: "JUROS ROTATIVO", metadata: {} });
    expect(r.kind).toBe("interest");
    expect(r.affectsIncomeExpense).toBe(false);
  });

  it("classifies credit_card transaction as purchase by default", () => {
    const r = classifyKindV1(creditCtx, { description: "LOJA ZARA", metadata: {} });
    expect(r.kind).toBe("purchase");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("classifies generic checking transaction as other", () => {
    const r = classifyKindV1(baseCtx, { description: "COMPRA SUPERMERCADO", metadata: {} });
    expect(r.kind).toBe("other");
    expect(r.affectsIncomeExpense).toBe(true);
  });

  it("LEDGER_RULE_VERSION_V1 constant has expected value", () => {
    expect(LEDGER_RULE_VERSION_V1).toBe("ledger_rules@v1");
  });
});

describe("normalizeSignV1", () => {
  it("refund is always positive regardless of raw sign", () => {
    const r = normalizeSignV1({ amount: -50, amountRawSignHint: "negative", ctx: baseCtx, kind: "refund" });
    expect(r.amountNormalized).toBe(50);
    expect(r.audit).toMatchObject({ signRule: "refund_positive" });
  });

  it("purchase with unknown hint becomes negative", () => {
    const r = normalizeSignV1({ amount: 100, amountRawSignHint: "unknown", ctx: baseCtx, kind: "purchase" });
    expect(r.amountNormalized).toBe(-100);
  });

  it("positive hint keeps amount positive (income)", () => {
    const r = normalizeSignV1({ amount: 200, amountRawSignHint: "positive", ctx: baseCtx, kind: "other" });
    expect(r.amountNormalized).toBe(200);
  });

  it("negative hint makes amount negative", () => {
    const r = normalizeSignV1({ amount: 300, amountRawSignHint: "negative", ctx: baseCtx, kind: "other" });
    expect(r.amountNormalized).toBe(-300);
  });

  it("inverted sign convention flips the final sign", () => {
    const r = normalizeSignV1({ amount: 100, amountRawSignHint: "positive", ctx: invertedCtx, kind: "other" });
    expect(r.amountNormalized).toBe(-100);
  });

  it("fee with unknown hint becomes negative", () => {
    const r = normalizeSignV1({ amount: 15, amountRawSignHint: "unknown", ctx: baseCtx, kind: "fee" });
    expect(r.amountNormalized).toBe(-15);
  });
});
