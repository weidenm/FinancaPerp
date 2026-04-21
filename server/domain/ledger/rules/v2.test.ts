import { describe, it, expect } from "vitest";
import { classifyKindV2, LEDGER_RULE_VERSION_V2 } from "./v2";

const baseCtx = {
  accountType: "checking" as const,
  signConvention: "natural" as const,
  sourceKind: "statement" as const,
  connectorId: "generic_csv",
};

describe("classifyKindV2", () => {
  it("classifies PIX as transfer when treatPixAsExpense=false", () => {
    const result = classifyKindV2(
      { ...baseCtx, treatPixAsExpense: false },
      { description: "PIX ENVIADO JOAO", metadata: {} },
    );
    expect(result.kind).toBe("transfer");
    expect(result.affectsIncomeExpense).toBe(false);
  });

  it("classifies PIX as income/expense (other) when treatPixAsExpense=true", () => {
    const result = classifyKindV2(
      { ...baseCtx, treatPixAsExpense: true },
      { description: "PIX RECEBIDO MARIA", metadata: {} },
    );
    expect(result.kind).toBe("other");
    expect(result.affectsIncomeExpense).toBe(true);
  });

  it("classifies TED as expense when treatPixAsExpense=true", () => {
    const result = classifyKindV2(
      { ...baseCtx, treatPixAsExpense: true },
      { description: "TED PARA BANCO INTER", metadata: {} },
    );
    expect(result.kind).toBe("other");
    expect(result.affectsIncomeExpense).toBe(true);
  });

  it("invoice payment is always transfer regardless of treatPixAsExpense", () => {
    const result = classifyKindV2(
      { ...baseCtx, treatPixAsExpense: true },
      { description: "PAGAMENTO FATURA CARTAO NUBANK", metadata: {} },
    );
    expect(result.kind).toBe("transfer");
    expect(result.affectsIncomeExpense).toBe(false);
  });

  it("refund always wins over PIX check", () => {
    const result = classifyKindV2(
      { ...baseCtx, treatPixAsExpense: false },
      { description: "ESTORNO PIX COMPRA", metadata: {} },
    );
    expect(result.kind).toBe("refund");
    expect(result.affectsIncomeExpense).toBe(true);
  });

  it("LEDGER_RULE_VERSION_V2 constant has expected value", () => {
    expect(LEDGER_RULE_VERSION_V2).toBe("ledger_rules@v2");
  });
});
