import type { RawDocument, RawTxnCandidate } from "../../domain/ledger/types";

function asIsoFromOfxDate(input: string): string | null {
  const base = input.replace(/\[.*?\]\s*$/, "").trim();
  const m = base.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Supports classic OFX SGML (`<TAG>value`) and XML-style (`<TAG>value</TAG>`). */
function getTag(block: string, tag: string): string | null {
  const t = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const xmlClosed = new RegExp(`<${t}\\s*>\\s*([\\s\\S]*?)\\s*</${t}\\s*>`, "i");
  const xm = block.match(xmlClosed);
  if (xm) {
    const v = xm[1].replace(/\s+/g, " ").trim();
    if (v) return v;
  }

  const sgml = new RegExp(`<${t}\\s*>\\s*([^<\\r\\n]*)`, "i");
  const sm = block.match(sgml);
  if (sm) {
    const v = sm[1].trim();
    if (v) return v;
  }

  return null;
}

export function mapGenericOfx(doc: RawDocument): RawTxnCandidate[] {
  const text = doc.rawText || "";
  const blocks = text.split(/<STMTTRN\b[^>]*>/i).slice(1);
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

    const amtTrim = trnamt.trim();
    out.push({
      externalId: fitid,
      postedAt,
      descriptionRaw,
      transactionCode: trntype,
      amountRaw: trnamt,
      amountRawSignHint: amtTrim.startsWith("-") ? "negative" : amtTrim.startsWith("+") ? "positive" : "unknown",
      metadata: { doc: doc.originalName, dtposted, fitid, trntype, name, memo },
    });
  }

  return out;
}
