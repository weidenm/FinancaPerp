import { describe, expect, test } from "vitest";
import { pickDuplicatesByFingerprint } from "./dedupe";

describe("pickDuplicatesByFingerprint", () => {
  test("marks later duplicates", () => {
    const dup = pickDuplicatesByFingerprint([
      { id: 1, fingerprint: "a" },
      { id: 2, fingerprint: "b" },
      { id: 3, fingerprint: "a" },
      { id: 4, fingerprint: "a" },
    ]);
    expect(dup.get(3)).toBe(1);
    expect(dup.get(4)).toBe(1);
    expect(dup.has(2)).toBe(false);
  });
});

