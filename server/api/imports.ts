import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { parseUploadToRawDocuments } from "../import/parser";
import { mapDocumentsToCandidates } from "../import/mappers";
import { normalizeCandidates, normalizeCandidatesV1 } from "../domain/ledger/pipeline";
import { pickDuplicatesByFingerprint } from "../domain/ledger/dedupe";
import {
  addAuditEvent,
  commitLedgerToAppTransactions,
  createImportRow,
  deleteLedgerByImport,
  findImportByIdempotencyKey,
  findExistingLedgerByFingerprints,
  getAccount,
  getImport,
  getLedgerTransaction,
  insertImportFiles,
  insertLedgerTransactions,
  insertRawTransactions,
  listImportFiles,
  listImports,
  listLedgerTransactions,
  listRawTransactions,
  listTransactionsByImport,
  markImportStatus,
  updateLedgerTransaction,
  updateTransactionCategory,
} from "../infra/ledgerRepo";
import { LEDGER_RULE_VERSION_V1 } from "../domain/ledger/rules/v1";
import { LEDGER_RULE_VERSION_V2 } from "../domain/ledger/rules/v2";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function buildIdempotencyKey(input: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

const DEFAULT_RULE_VERSION = LEDGER_RULE_VERSION_V2;

const createImportBodySchema = z.object({
  accountId: z.coerce.number().int().positive(),
  connectorId: z.string().optional(),
  sourceKind: z.enum(["statement", "card_invoice"]),
  ruleVersion: z.string().min(1).optional().default(DEFAULT_RULE_VERSION),
});

async function runNormalizePipeline(params: {
  importId: number;
  account: { id: number; type: "checking" | "savings" | "credit_card"; signConvention: "natural" | "inverted"; treatPixAsExpense: boolean };
  connectorId: string;
  sourceKind: "statement" | "card_invoice";
  ruleVersion: string;
  candidates: import("../domain/ledger/types").RawTxnCandidate[];
}) {
  const { importId, account, connectorId, sourceKind, ruleVersion, candidates } = params;

  const normalized = normalizeCandidates({
    accountId: account.id,
    connectorId,
    accountType: account.type,
    signConvention: account.signConvention,
    sourceKind,
    candidates,
    treatPixAsExpense: account.treatPixAsExpense,
    ruleVersion,
  });

  const existingFp = await findExistingLedgerByFingerprints({
    accountId: account.id,
    fingerprints: normalized.map((n) => n.fingerprint),
  });
  const existingByFp = new Map(existingFp.map((x) => [x.fingerprint, x.id]));

  const now = new Date().toISOString();
  const ledgerRows = normalized.map((n) => ({
    importId,
    accountId: account.id,
    postedAt: n.postedAt,
    descriptionNormalized: n.descriptionNormalized,
    amountRaw: n.amountRaw,
    amountNormalized: n.amountNormalized,
    fingerprint: n.fingerprint,
    kind: n.kind,
    affectsIncomeExpense: n.affectsIncomeExpense,
    transferGroupId: n.transferGroupId ?? null,
    duplicateOfId: existingByFp.get(n.fingerprint) ?? null,
    confidence: n.confidence,
    ruleVersion,
    auditJson: JSON.stringify(n.audit),
    needsReview: n.needsReview || existingByFp.has(n.fingerprint),
    reviewNotes: null,
    updatedAt: now,
  }));

  const inserted = await insertLedgerTransactions(ledgerRows as any);
  const dupMap = pickDuplicatesByFingerprint(
    inserted
      .filter((t) => t.duplicateOfId == null)
      .map((t) => ({ id: t.id, fingerprint: t.fingerprint })),
  );
  for (const [id, dupOf] of Array.from(dupMap.entries())) {
    await updateLedgerTransaction(id, { duplicateOfId: dupOf, needsReview: true });
  }

  return inserted;
}

export function registerImportRoutes(app: Express) {
  app.get("/api/imports", async (_req, res) => {
    const allImports = await listImports();
    // Enrich with account info per import (batch)
    const { listAccounts } = await import("../infra/ledgerRepo");
    const accounts = await listAccounts();
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    res.json(
      allImports.map((imp) => ({
        ...imp,
        accountName: accountMap.get(imp.accountId)?.name ?? null,
        accountType: accountMap.get(imp.accountId)?.type ?? null,
      })),
    );
  });

  app.get("/api/imports/:id", async (req, res) => {
    const imp = await getImport(Number(req.params.id));
    if (!imp) return res.status(404).json({ error: "Import not found" });
    res.json(imp);
  });

  app.get("/api/imports/:id/files", async (req, res) => {
    res.json(await listImportFiles(Number(req.params.id)));
  });

  app.get("/api/imports/:id/raw-transactions", async (req, res) => {
    res.json(await listRawTransactions(Number(req.params.id)));
  });

  app.get("/api/imports/:id/ledger-transactions", async (req, res) => {
    const includeDuplicates = req.query.includeDuplicates === "true";
    res.json(await listLedgerTransactions(Number(req.params.id), { includeDuplicates }));
  });

  app.get("/api/imports/:id/committed-transactions", async (req, res) => {
    res.json(await listTransactionsByImport(Number(req.params.id)));
  });

  app.post("/api/imports", upload.array("files"), async (req: Request, res: Response) => {
    const parsed = createImportBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const files = ((req as any).files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const account = await getAccount(parsed.data.accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const connectorId =
      (parsed.data.connectorId && String(parsed.data.connectorId).trim()) ||
      account.connectorId ||
      "generic_csv";

    const fileDigests = files.map((f) => ({
      originalName: f.originalname,
      mime: f.mimetype,
      sha256: sha256(f.buffer),
      sizeBytes: f.size,
    }));

    const ruleVersion = parsed.data.ruleVersion;

    const idempotencyKey = buildIdempotencyKey({
      accountId: parsed.data.accountId,
      connectorId,
      sourceKind: parsed.data.sourceKind,
      ruleVersion,
      files: fileDigests.map((f) => f.sha256).sort(),
    });

    const existing = await findImportByIdempotencyKey(idempotencyKey);
    if (existing) {
      const ledger = await listLedgerTransactions(existing.id, { includeDuplicates: true });
      return res.json({
        importId: existing.id,
        status: existing.status,
        idempotencyKey,
        counts: {
          ledger: ledger.length,
          duplicates: ledger.filter((t) => t.duplicateOfId != null).length,
          needsReview: ledger.filter((t) => t.needsReview).length,
        },
      });
    }

    const importRow = await createImportRow({
      createdAt: new Date().toISOString(),
      accountId: parsed.data.accountId,
      sourceKind: parsed.data.sourceKind,
      connectorId,
      idempotencyKey,
      ruleVersion,
      status: "parsed",
    } as any);

    await addAuditEvent({
      entity: "imports",
      entityId: importRow.id,
      actor: "system",
      event: "created",
      diffJson: JSON.stringify({ idempotencyKey, fileCount: files.length }),
    });

    await insertImportFiles(importRow.id, fileDigests);

    const docs = await parseUploadToRawDocuments(files);
    const candidates = mapDocumentsToCandidates({ connectorId, docs });

    const rawRows = candidates.map((c) => ({
      importId: importRow.id,
      externalId: c.externalId ?? null,
      postedAt: c.postedAt,
      descriptionRaw: c.descriptionRaw,
      transactionCode: c.transactionCode ?? null,
      amountRaw: c.amountRaw,
      amountRawSignHint: c.amountRawSignHint ?? "unknown",
      metadataJson: JSON.stringify(c.metadata ?? {}),
    }));
    await insertRawTransactions(importRow.id, rawRows as any);

    await runNormalizePipeline({
      importId: importRow.id,
      account,
      connectorId,
      sourceKind: parsed.data.sourceKind,
      ruleVersion,
      candidates,
    });

    const ledgerAll = await listLedgerTransactions(importRow.id, { includeDuplicates: true });
    const needsReviewCount = ledgerAll.filter((t) => t.needsReview).length;
    await markImportStatus(importRow.id, needsReviewCount > 0 ? "needs_review" : "parsed");

    res.status(201).json({
      importId: importRow.id,
      status: needsReviewCount > 0 ? "needs_review" : "parsed",
      idempotencyKey,
      counts: {
        raw: rawRows.length,
        ledger: ledgerAll.length,
        duplicates: ledgerAll.filter((t) => t.duplicateOfId != null).length,
        needsReview: needsReviewCount,
      },
    });
  });

  app.post("/api/imports/:id/reprocess", async (req, res) => {
    const importId = Number(req.params.id);
    const imp = await getImport(importId);
    if (!imp) return res.status(404).json({ error: "Import not found" });

    const ruleVersion = String(req.body?.ruleVersion || imp.ruleVersion || DEFAULT_RULE_VERSION);

    const account = await getAccount(imp.accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const raws = await listRawTransactions(importId);
    const candidates = raws.map((r) => ({
      externalId: r.externalId,
      postedAt: r.postedAt,
      descriptionRaw: r.descriptionRaw,
      transactionCode: r.transactionCode,
      amountRaw: r.amountRaw,
      amountRawSignHint: r.amountRawSignHint as any,
      metadata: JSON.parse(r.metadataJson || "{}"),
    }));

    await deleteLedgerByImport(importId);

    await runNormalizePipeline({
      importId,
      account,
      connectorId: imp.connectorId,
      sourceKind: imp.sourceKind,
      ruleVersion,
      candidates,
    });

    const ledgerAll = await listLedgerTransactions(importId, { includeDuplicates: true });
    const needsReviewCount = ledgerAll.filter((t) => t.needsReview).length;
    await markImportStatus(importId, needsReviewCount > 0 ? "needs_review" : "parsed");

    await addAuditEvent({
      entity: "imports",
      entityId: importId,
      actor: "system",
      event: "reprocessed",
      diffJson: JSON.stringify({ ruleVersion }),
    });

    res.json({
      importId,
      status: needsReviewCount > 0 ? "needs_review" : "parsed",
      counts: {
        raw: raws.length,
        ledger: ledgerAll.length,
        duplicates: ledgerAll.filter((t) => t.duplicateOfId != null).length,
        needsReview: needsReviewCount,
      },
    });
  });

  app.patch("/api/ledger-transactions/:id", async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getLedgerTransaction(id);
    if (!existing) return res.status(404).json({ error: "Ledger transaction not found" });

    const patchSchema = z.object({
      kind: z.enum(["purchase", "payment", "refund", "transfer", "fee", "interest", "other"]).optional(),
      amountNormalized: z.number().optional(),
      affectsIncomeExpense: z.boolean().optional(),
      needsReview: z.boolean().optional(),
      reviewNotes: z.string().optional(),
      duplicateOfId: z.number().int().positive().nullable().optional(),
      transferGroupId: z.string().nullable().optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await updateLedgerTransaction(id, parsed.data as any);
    await addAuditEvent({
      entity: "ledger_transactions",
      entityId: id,
      actor: "user",
      event: "patched",
      diffJson: JSON.stringify({ before: existing, after: updated }),
    });
    res.json(updated);
  });

  app.post("/api/imports/:id/commit", async (req, res) => {
    const importId = Number(req.params.id);
    const imp = await getImport(importId);
    if (!imp) return res.status(404).json({ error: "Import not found" });

    if (imp.status === "committed") {
      return res.json({ importId, created: 0, alreadyCommitted: true });
    }

    const result = await commitLedgerToAppTransactions({ importId });
    await markImportStatus(importId, "committed");

    await addAuditEvent({
      entity: "imports",
      entityId: importId,
      actor: "system",
      event: "committed",
      diffJson: JSON.stringify(result),
    });

    res.json({ importId, ...result });
  });

  // Bulk categorize committed transactions from an import
  app.post("/api/imports/:id/bulk-categorize", async (req, res) => {
    const importId = Number(req.params.id);
    const imp = await getImport(importId);
    if (!imp) return res.status(404).json({ error: "Import not found" });

    const bodySchema = z.object({
      assignments: z.array(
        z.object({
          transactionId: z.number().int().positive(),
          categoryId: z.number().int().positive().nullable(),
        }),
      ),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    let updated = 0;
    for (const { transactionId, categoryId } of parsed.data.assignments) {
      await updateTransactionCategory(transactionId, categoryId);
      updated++;
    }

    res.json({ updated });
  });
}
