import { describe, it, expect } from "vitest";
import { mapGenericXlsx } from "./genericXlsx";
import type { RawDocument } from "../../domain/ledger/types";

function makeDoc(rows: Record<string, unknown>[]): RawDocument {
  return { source: "xlsx", originalName: "extrato.xlsx", rows };
}

describe("mapGenericXlsx", () => {
  it("maps rows with PT-BR headers (data/histórico/valor)", () => {
    const doc = makeDoc([
      { "Data": "15/03/2026", "Histórico": "Compra Supermercado", "Valor": "123,45" },
      { "Data": "16/03/2026", "Histórico": "PIX Enviado", "Valor": "-50,00" },
    ]);
    const rows = mapGenericXlsx(doc);
    expect(rows).toHaveLength(2);
    expect(rows[0].postedAt).toBe("2026-03-15");
    expect(rows[0].descriptionRaw).toBe("Compra Supermercado");
    expect(rows[0].amountRaw).toBe("123,45");
    expect(rows[1].postedAt).toBe("2026-03-16");
    expect(rows[1].descriptionRaw).toBe("PIX Enviado");
    expect(rows[1].amountRaw).toBe("-50,00");
  });

  it("maps rows with EN headers (date/description/amount)", () => {
    const doc = makeDoc([
      { "date": "2026-01-10", "description": "Grocery store", "amount": "200.00" },
    ]);
    const rows = mapGenericXlsx(doc);
    expect(rows).toHaveLength(1);
    expect(rows[0].postedAt).toBe("2026-01-10");
    expect(rows[0].descriptionRaw).toBe("Grocery store");
    expect(rows[0].amountRaw).toBe("200.00");
  });

  it("returns empty array when document has no rows", () => {
    const doc: RawDocument = { source: "xlsx", originalName: "empty.xlsx", rows: [] };
    expect(mapGenericXlsx(doc)).toHaveLength(0);
  });

  it("infers date when column not recognized and sets dateInferred flag", () => {
    const doc = makeDoc([
      { "foo": "bar", "amount": "100" },
    ]);
    const rows = mapGenericXlsx(doc);
    expect(rows).toHaveLength(1);
    // Date couldn't be parsed, so today's ISO date is used and dateInferred=true
    expect(rows[0].metadata).toMatchObject({ dateInferred: true });
  });

  it("Excel numeric date (days since 1899-12-30) is parsed correctly", () => {
    // Excel serial 46096 = 2026-03-15
    const doc = makeDoc([
      { "Data": 46096, "Histórico": "Pagamento", "Valor": "500" },
    ]);
    const rows = mapGenericXlsx(doc);
    expect(rows).toHaveLength(1);
    expect(rows[0].postedAt).toBe("2026-03-15");
  });
});
