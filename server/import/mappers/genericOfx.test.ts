import { describe, it, expect } from "vitest";
import { mapGenericOfx } from "./genericOfx";
import type { RawDocument } from "../../domain/ledger/types";

function makeOfxDoc(text: string): RawDocument {
  return { source: "ofx", originalName: "extrato.ofx", rawText: text };
}

const sampleOfx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260315
<TRNAMT>-123.45
<FITID>TXN001
<NAME>SUPERMERCADO ABC
<MEMO>Compra debito
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260316120000
<TRNAMT>+5000.00
<FITID>TXN002
<NAME>SALARIO EMPRESA
<MEMO>Credito salario
</STMTTRN>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe("mapGenericOfx", () => {
  it("parses DTPOSTED YYYYMMDD into ISO date", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].postedAt).toBe("2026-03-15");
  });

  it("parses DTPOSTED YYYYMMDDHHMMSS into ISO date (date portion only)", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[1].postedAt).toBe("2026-03-16");
  });

  it("captures NAME and MEMO as description", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].descriptionRaw).toBe("SUPERMERCADO ABC Compra debito");
    expect(rows[1].descriptionRaw).toBe("SALARIO EMPRESA Credito salario");
  });

  it("preserves TRNAMT as amountRaw string", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].amountRaw).toBe("-123.45");
    expect(rows[1].amountRaw).toBe("+5000.00");
  });

  it("sets negative sign hint for negative TRNAMT", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].amountRawSignHint).toBe("negative");
  });

  it("sets positive sign hint for positive TRNAMT", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[1].amountRawSignHint).toBe("positive");
  });

  it("captures FITID as externalId", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].externalId).toBe("TXN001");
    expect(rows[1].externalId).toBe("TXN002");
  });

  it("captures TRNTYPE as transactionCode", () => {
    const rows = mapGenericOfx(makeOfxDoc(sampleOfx));
    expect(rows[0].transactionCode).toBe("DEBIT");
    expect(rows[1].transactionCode).toBe("CREDIT");
  });

  it("returns empty array for OFX with no STMTTRN blocks", () => {
    const rows = mapGenericOfx(makeOfxDoc("<OFX></OFX>"));
    expect(rows).toHaveLength(0);
  });
});
