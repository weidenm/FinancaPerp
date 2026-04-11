/** Parse common BR / ISO date strings to YYYY-MM-DD. */

export function asIsoDateFromString(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }

  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${m[1]}-${mo}-${d}`;
  }

  return null;
}

/** Excel / Sheets serial (days since 1899-12-30, UTC date only). */
function excelSerialToIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 1000000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(n) * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function asIsoDateLoose(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === "number" && Number.isFinite(input)) {
    const fromStr = asIsoDateFromString(String(input));
    if (fromStr) return fromStr;
    return excelSerialToIso(Math.trunc(input));
  }
  if (typeof input === "string") return asIsoDateFromString(input);
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  return null;
}
