import { describe, expect, test } from "vitest";
import {
  splitCsvLineWithSep,
  detectCsvDelimiter,
  mapGenericCsv,
} from "./genericCsv";
import type { RawDocument } from "../../domain/ledger/types";

describe("genericCsv", () => {
  test("detectCsvDelimiter prefers semicolon when decimals use comma", () => {
    const lines = [
      "Data;Histórico;Valor",
      "15/03/2026;Supermercado;123,45",
      "16/03/2026;Pix;-50,00",
    ];
    expect(detectCsvDelimiter(lines)).toBe(";");
  });

  test("mapGenericCsv parses BR CSV with semicolon and decimal comma", () => {
    const csv = [
      "Data da Transação;Histórico;Valor (R$)",
      "15/03/2026;Compra teste;1.234,56",
      "1/4/2026;Outra;26,00",
    ].join("\n");
    const doc: RawDocument = { source: "csv", originalName: "extrato.csv", rawText: csv };
    const rows = mapGenericCsv(doc);
    expect(rows).toHaveLength(2);
    expect(rows[0].postedAt).toBe("2026-03-15");
    expect(rows[0].descriptionRaw).toBe("Compra teste");
    expect(rows[0].amountRaw).toBe("1.234,56");
    expect(rows[1].postedAt).toBe("2026-04-01");
    expect(rows[1].amountRaw).toBe("26,00");
    expect(rows[0].metadata).toMatchObject({ dateInferred: false, csvDelimiter: ";" });
  });

  test("splitCsvLineWithSep respects quoted fields with comma inside", () => {
    const line = `"A, B";15/03/2026;10,00`;
    expect(splitCsvLineWithSep(line, ";")).toEqual(["A, B", "15/03/2026", "10,00"]);
  });

  test("comma-separated with ISO dates still works", () => {
    const csv = ["date,description,amount", "2026-02-01,Foo,100.50"].join("\n");
    const doc: RawDocument = { source: "csv", originalName: "x.csv", rawText: csv };
    const rows = mapGenericCsv(doc);
    expect(rows).toHaveLength(1);
    expect(rows[0].postedAt).toBe("2026-02-01");
    expect(rows[0].descriptionRaw).toBe("Foo");
  });
});
