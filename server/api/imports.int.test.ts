import { describe, expect, test, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db } from "../infra/db";
import { accounts, imports, importFiles, rawTransactions, ledgerTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";

let app: any;
let accountId: number;
let createdImportId: number | null = null;

beforeAll(async () => {
  const mod = await import("../app");
  const created = await mod.createApp();
  app = created.app;

  const acc = await db
    .insert(accounts)
    .values({
      name: `Test Checking ${Date.now()}`,
      type: "checking",
      connectorId: "generic_csv",
      signConvention: "natural",
      currency: "BRL",
    })
    .returning()
    .get();
  accountId = acc.id;
});

afterAll(async () => {
  if (createdImportId != null) {
    await db.delete(ledgerTransactions).where(eq(ledgerTransactions.importId, createdImportId)).run();
    await db.delete(rawTransactions).where(eq(rawTransactions.importId, createdImportId)).run();
    await db.delete(importFiles).where(eq(importFiles.importId, createdImportId)).run();
    await db.delete(imports).where(eq(imports.id, createdImportId)).run();
  }
  await db.delete(accounts).where(eq(accounts.id, accountId)).run();
});

describe("imports API", () => {
  test("creates an import from CSV and returns counts", async () => {
    const csv = [
      "date,description,amount",
      "2026-01-01,Supermercado,123.45",
      "2026-01-02,PAGAMENTO FATURA CARTAO,500.00",
      "2026-01-03,ESTORNO COMPRA,50.00",
    ].join("\n");

    const res = await request(app)
      .post("/api/imports")
      .field("accountId", String(accountId))
      .field("connectorId", "generic_csv")
      .field("sourceKind", "statement")
      .attach("files", Buffer.from(csv, "utf-8"), { filename: "stmt.csv", contentType: "text/csv" });

    expect(res.status).toBe(201);
    expect(res.body.importId).toBeTypeOf("number");
    expect(res.body.counts.raw).toBe(3);
    expect(res.body.counts.ledger).toBe(3);
    createdImportId = res.body.importId;

    const ledgerRes = await request(app).get(`/api/imports/${createdImportId}/ledger-transactions?includeDuplicates=true`);
    expect(ledgerRes.status).toBe(200);
    const ledger = ledgerRes.body as any[];
    expect(ledger.find((t) => String(t.descriptionNormalized).includes("PAGAMENTO FATURA"))?.kind).toBe("transfer");
  });
});

