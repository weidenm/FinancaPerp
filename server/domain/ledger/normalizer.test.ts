import { describe, expect, test } from "vitest";
import { normalizeCandidateV1 } from "./normalizer";

describe("normalizeCandidateV1", () => {
  test("refund is always positive", () => {
    const n = normalizeCandidateV1({
      accountId: 1,
      connectorId: "generic",
      accountType: "checking",
      signConvention: "natural",
      sourceKind: "statement",
      candidate: {
        postedAt: "2026-01-01",
        descriptionRaw: "ESTORNO COMPRA",
        amountRaw: "-123,45",
        amountRawSignHint: "negative",
        metadata: {},
      },
    });
    expect(n.amountNormalized).toBeGreaterThan(0);
    expect(n.kind).toBe("refund");
  });

  test("payment of invoice is transfer and not income/expense", () => {
    const n = normalizeCandidateV1({
      accountId: 1,
      connectorId: "generic",
      accountType: "checking",
      signConvention: "natural",
      sourceKind: "statement",
      candidate: {
        postedAt: "2026-01-01",
        descriptionRaw: "PAGAMENTO FATURA CARTAO",
        amountRaw: "-500.00",
        amountRawSignHint: "negative",
        metadata: {},
      },
    });
    expect(n.kind).toBe("transfer");
    expect(n.affectsIncomeExpense).toBe(false);
  });

  test("credit card inverted convention flips sign", () => {
    const n = normalizeCandidateV1({
      accountId: 1,
      connectorId: "generic",
      accountType: "credit_card",
      signConvention: "inverted",
      sourceKind: "card_invoice",
      candidate: {
        postedAt: "2026-01-01",
        descriptionRaw: "Compra mercado",
        amountRaw: "100.00",
        amountRawSignHint: "positive",
        metadata: {},
      },
    });
    expect(n.amountNormalized).toBeLessThan(0);
    expect(n.kind).toBe("purchase");
  });
});

