import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  accounts,
  importFiles,
  imports,
  ledgerAuditEvents,
  ledgerTransactions,
  rawTransactions,
  transactions,
  categories,
  type Account,
  type Import,
  type LedgerTransaction,
  type RawTransaction,
} from "@shared/schema";

export async function getAccount(accountId: number): Promise<Account | undefined> {
  return await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
}

export async function listAccounts() {
  return await db.select().from(accounts).orderBy(desc(accounts.id)).all();
}

export async function createAccountRow(data: Omit<Account, "id">): Promise<Account> {
  return await db.insert(accounts).values(data).returning().get();
}

export async function findImportByIdempotencyKey(idempotencyKey: string): Promise<Import | undefined> {
  return await db.select().from(imports).where(eq(imports.idempotencyKey, idempotencyKey)).get();
}

export async function createImportRow(data: Omit<Import, "id" | "status"> & { status?: Import["status"] }): Promise<Import> {
  return await db
    .insert(imports)
    .values({
      createdAt: data.createdAt,
      accountId: data.accountId,
      sourceKind: data.sourceKind,
      connectorId: data.connectorId,
      idempotencyKey: data.idempotencyKey,
      ruleVersion: data.ruleVersion,
      status: data.status ?? "parsed",
    })
    .returning()
    .get();
}

export async function insertImportFiles(importId: number, files: { originalName: string; mime: string; sha256: string; sizeBytes: number }[]) {
  if (files.length === 0) return [];
  return await db
    .insert(importFiles)
    .values(files.map((f) => ({ ...f, importId })))
    .returning()
    .all();
}

export async function insertRawTransactions(importId: number, rows: Omit<RawTransaction, "id">[]) {
  if (rows.length === 0) return [];
  return await db.insert(rawTransactions).values(rows).returning().all();
}

export async function insertLedgerTransactions(rows: Omit<LedgerTransaction, "id">[]) {
  if (rows.length === 0) return [];
  return await db.insert(ledgerTransactions).values(rows).returning().all();
}

export async function addAuditEvent(params: {
  entity: string;
  entityId: number;
  actor: "system" | "user";
  event: string;
  diffJson: string;
}) {
  await db.insert(ledgerAuditEvents).values({
    entity: params.entity,
    entityId: params.entityId,
    at: new Date().toISOString(),
    actor: params.actor,
    event: params.event,
    diffJson: params.diffJson,
  }).run();
}

export async function listImports(limit = 50) {
  return await db.select().from(imports).orderBy(desc(imports.createdAt)).limit(limit).all();
}

export async function getImport(importId: number) {
  return await db.select().from(imports).where(eq(imports.id, importId)).get();
}

export async function listImportFiles(importId: number) {
  return await db.select().from(importFiles).where(eq(importFiles.importId, importId)).all();
}

export async function listRawTransactions(importId: number) {
  return await db.select().from(rawTransactions).where(eq(rawTransactions.importId, importId)).all();
}

export async function listLedgerTransactions(importId: number, opts?: { includeDuplicates?: boolean }) {
  if (opts?.includeDuplicates) {
    return await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.importId, importId)).all();
  }
  return await db
    .select()
    .from(ledgerTransactions)
    .where(and(eq(ledgerTransactions.importId, importId), isNull(ledgerTransactions.duplicateOfId)))
    .all();
}

export async function getLedgerTransaction(id: number) {
  return await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.id, id)).get();
}

export async function updateLedgerTransaction(
  id: number,
  patch: Partial<Pick<LedgerTransaction, "kind" | "amountNormalized" | "affectsIncomeExpense" | "needsReview" | "reviewNotes" | "duplicateOfId" | "transferGroupId">>,
) {
  return await db
    .update(ledgerTransactions)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(ledgerTransactions.id, id))
    .returning()
    .get();
}

export async function getCategoriesMap(): Promise<Map<string, number>> {
  const cats = await db.select().from(categories).all();
  const m = new Map<string, number>();
  for (const c of cats) m.set(c.name.toLowerCase(), c.id);
  return m;
}

export async function commitLedgerToAppTransactions(params: { importId: number }) {
  const rows = await db
    .select()
    .from(ledgerTransactions)
    .where(
      and(
        eq(ledgerTransactions.importId, params.importId),
        isNull(ledgerTransactions.duplicateOfId),
        eq(ledgerTransactions.affectsIncomeExpense, true),
      ),
    )
    .all();

  const withValue = rows.filter((t) => Math.abs(t.amountNormalized) > 1e-9);
  if (withValue.length === 0) return { created: 0 };

  const inserts = withValue.map((t) => {
    const isIncome = t.amountNormalized > 0;
    return {
      description: t.descriptionNormalized,
      amount: Math.abs(t.amountNormalized),
      type: isIncome ? ("receita" as const) : ("despesa" as const),
      categoryId: null,
      date: t.postedAt,
    };
  });

  await db.insert(transactions).values(inserts).run();
  return { created: inserts.length };
}

export async function markImportStatus(importId: number, status: Import["status"]) {
  await db.update(imports).set({ status }).where(eq(imports.id, importId)).run();
}

export async function deleteLedgerByImport(importId: number) {
  const ids = await db.select({ id: ledgerTransactions.id }).from(ledgerTransactions).where(eq(ledgerTransactions.importId, importId)).all();
  if (ids.length) {
    await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.id, ids.map((x) => x.id))).run();
  }
}

export async function findExistingLedgerByFingerprints(params: { accountId: number; fingerprints: string[] }) {
  if (params.fingerprints.length === 0) return [];
  return await db
    .select({ id: ledgerTransactions.id, fingerprint: ledgerTransactions.fingerprint })
    .from(ledgerTransactions)
    .where(and(eq(ledgerTransactions.accountId, params.accountId), inArray(ledgerTransactions.fingerprint, params.fingerprints)))
    .all();
}

