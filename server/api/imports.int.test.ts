import { describe, expect, test, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db } from "../infra/db";
import {
  accounts,
  imports,
  importFiles,
  rawTransactions,
  ledgerTransactions,
  transactions,
} from "@shared/schema";
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
  await db.delete(transactions).where(eq(transactions.date, "2026-01-01")).run();
  await db.delete(transactions).where(eq(transactions.date, "2026-01-03")).run();
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
    expect(res.body.autoCommitRecommended).toBe(true);
    createdImportId = res.body.importId;

    const ledgerRes = await request(app).get(`/api/imports/${createdImportId}/ledger-transactions?includeDuplicates=true`);
    expect(ledgerRes.status).toBe(200);
    const ledger = ledgerRes.body as any[];
    expect(ledger.find((t) => String(t.descriptionNormalized).includes("PAGAMENTO FATURA"))?.kind).toBe("transfer");

    const commitRes = await request(app).post(`/api/imports/${createdImportId}/commit`);
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.created).toBe(2);

    const txRes = await request(app).get("/api/transactions?startDate=2026-01-01&endDate=2026-01-31");
    expect(txRes.status).toBe(200);
    const txs = txRes.body as any[];
    expect(txs.some((t) => String(t.description).includes("Supermercado"))).toBe(true);

    const commitAgain = await request(app).post(`/api/imports/${createdImportId}/commit`);
    expect(commitAgain.status).toBe(200);
    expect(commitAgain.body.alreadyCommitted).toBe(true);
    expect(commitAgain.body.created).toBe(0);
  });

  test("accepts import without connectorId (uses account default)", async () => {
    const csv = ["date,description,amount", "2026-02-01,Only row,10.00"].join("\n");
    const res = await request(app)
      .post("/api/imports")
      .field("accountId", String(accountId))
      .field("sourceKind", "statement")
      .attach("files", Buffer.from(csv, "utf-8"), { filename: "x.csv", contentType: "text/csv" });

    expect(res.status).toBe(201);
    const impId = res.body.importId as number;
    const commitRes = await request(app).post(`/api/imports/${impId}/commit`);
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.created).toBe(1);
    await db.delete(transactions).where(eq(transactions.date, "2026-02-01")).run();
    await db.delete(ledgerTransactions).where(eq(ledgerTransactions.importId, impId)).run();
    await db.delete(rawTransactions).where(eq(rawTransactions.importId, impId)).run();
    await db.delete(importFiles).where(eq(importFiles.importId, impId)).run();
    await db.delete(imports).where(eq(imports.id, impId)).run();
  });

  test("TXT-only import sets autoCommitRecommended false and marks needs_review", async () => {
    const res = await request(app)
      .post("/api/imports")
      .field("accountId", String(accountId))
      .field("sourceKind", "statement")
      .attach("files", Buffer.from("Extrato sem tabela", "utf-8"), {
        filename: "note.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(201);
    expect(res.body.autoCommitRecommended).toBe(false);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    expect(res.body.counts.raw).toBe(1);
    expect(res.body.status).toBe("needs_review");

    const impId = res.body.importId as number;
    const commitRes = await request(app).post(`/api/imports/${impId}/commit`);
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.created).toBe(0);

    await db.delete(ledgerTransactions).where(eq(ledgerTransactions.importId, impId)).run();
    await db.delete(rawTransactions).where(eq(rawTransactions.importId, impId)).run();
    await db.delete(importFiles).where(eq(importFiles.importId, impId)).run();
    await db.delete(imports).where(eq(imports.id, impId)).run();
  });
});

