/** Normalized header keys and matchers for bank exports (PT-BR + EN). */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeHeader(h: string): string {
  return stripAccents(h)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

export function isDateHeader(h: string): boolean {
  if (["data", "date", "dt", "posted_at", "postedat", "vencimento"].includes(h)) return true;
  if (h.startsWith("data_da") || h.includes("datatrans") || h.includes("data_trans")) return true;
  if (h.includes("posted") && !h.includes("unposted")) return true;
  return false;
}

export function isDescHeader(h: string): boolean {
  if (
    [
      "description",
      "descricao",
      "historico",
      "memo",
      "lancamento",
      "estabelecimento",
      "detalhe",
      "desc",
      "titulo",
      "nome",
    ].includes(h)
  )
    return true;
  if (h.includes("histor")) return true;
  if (h.includes("descricao") || (h.includes("desc") && !h.includes("metadata"))) return true;
  if (h.includes("lancamento") || h.includes("lanc_")) return true;
  return false;
}

export function isAmountHeader(h: string): boolean {
  if (h.includes("datavalor")) return false;
  if (["amount", "valor", "value", "credito", "credit", "debito", "debit", "quantia"].includes(h))
    return true;
  if (h.includes("credito") || h.includes("credit")) return true;
  if (h.includes("debito") || h.includes("debit")) return true;
  if (h.includes("valor_") || h.endsWith("_valor")) return true;
  return false;
}
