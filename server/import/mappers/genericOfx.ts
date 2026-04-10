import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";

function asIsoFromOfxDate(input: string): string | null {
  // OFX DTPOSTED often YYYYMMDD or YYYYMMDDHHMMSS
  const m = input.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function getTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export function mapGenericOfx(doc: RawDocument): RawTxnCandidate[] {
  const text = doc.rawText || "";
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const out: RawTxnCandidate[] = [];

  for (const b of blocks) {
    const fitid = getTag(b, "FITID");
    const dtposted = getTag(b, "DTPOSTED") || "";
    const trnamt = getTag(b, "TRNAMT") || "";
    const name = getTag(b, "NAME") || "";
    const memo = getTag(b, "MEMO") || "";
    const trntype = getTag(b, "TRNTYPE");

    const postedAt = asIsoFromOfxDate(dtposted) || new Date().toISOString().slice(0, 10);
    const descriptionRaw = [name, memo].filter(Boolean).join(" ").trim();

    out.push({
      externalId: fitid,
      postedAt,
      descriptionRaw,
      transactionCode: trntype,
      amountRaw: trnamt,
      amountRawSignHint: trnamt.trim().startsWith("-") ? "negative" : trnamt.trim().startsWith("+") ? "positive" : "unknown",
      metadata: { doc: doc.originalName, dtposted, fitid, trntype, name, memo },
    });
  }

  return out;
}

