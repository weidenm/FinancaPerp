export function pickDuplicatesByFingerprint(items: { id: number; fingerprint: string }[]): Map<number, number> {
  const firstByFp = new Map<string, number>();
  const duplicateOf = new Map<number, number>();

  for (const it of items) {
    const firstId = firstByFp.get(it.fingerprint);
    if (firstId == null) {
      firstByFp.set(it.fingerprint, it.id);
      continue;
    }
    duplicateOf.set(it.id, firstId);
  }

  return duplicateOf;
}

