import crypto from "node:crypto";
import type { NormalizedLedgerTxn } from "./types";

function stableGroupId(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export function assignTransferGroups(txns: NormalizedLedgerTxn[]): NormalizedLedgerTxn[] {
  // Minimal v1: group transfers/payments by same day + abs(amount) + kind.
  return txns.map((t) => {
    if (t.kind !== "transfer") return t;
    const gid = stableGroupId([t.postedAt, Math.abs(t.amountNormalized).toFixed(2), t.kind]);
    return { ...t, transferGroupId: gid };
  });
}

