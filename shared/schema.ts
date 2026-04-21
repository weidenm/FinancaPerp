import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Categories table
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("circle"),
  color: text("color").notNull().default("slate"),
  type: text("type", { enum: ["receita", "despesa", "ambos"] }).notNull().default("ambos"),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Transactions table
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  type: text("type", { enum: ["receita", "despesa"] }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  ledgerTransactionId: integer("ledger_transaction_id"), // nullable back-ref to ledger_transactions
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true }).extend({
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().min(1, "Descrição obrigatória"),
  date: z.string().min(1, "Data obrigatória"),
  categoryId: z.number().int().positive().nullable().optional(),
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Budgets table
export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  limit: real("limit").notNull(),
  month: text("month").notNull(), // YYYY-MM
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true }).extend({
  limit: z.number().positive("Limite deve ser positivo"),
});
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// Goals table
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline: text("deadline"), // ISO date string
  icon: text("icon").notNull().default("target"),
});

export const insertGoalSchema = createInsertSchema(goals).omit({ id: true }).extend({
  targetAmount: z.number().positive("Meta deve ser positiva"),
  currentAmount: z.number().min(0).default(0),
  name: z.string().min(1, "Nome obrigatório"),
  deadline: z.string().min(1).nullable().optional(),
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Ledger import + normalization (canonical signed amounts)
// ─────────────────────────────────────────────────────────────────────────────

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings", "credit_card"] })
    .notNull(),
  connectorId: text("connector_id").notNull(),
  signConvention: text("sign_convention", { enum: ["natural", "inverted"] })
    .notNull()
    .default("natural"),
  currency: text("currency").notNull().default("BRL"),
  treatPixAsExpense: integer("treat_pix_as_expense", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true }).extend({
  name: z.string().min(1, "Nome obrigatório"),
  connectorId: z.string().min(1, "Connector obrigatório"),
  treatPixAsExpense: z.boolean().optional().default(false),
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  sourceKind: text("source_kind", { enum: ["statement", "card_invoice"] }).notNull(),
  connectorId: text("connector_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  ruleVersion: text("rule_version").notNull(),
  status: text("status", { enum: ["parsed", "needs_review", "committed", "failed"] })
    .notNull()
    .default("parsed"),
});

export const insertImportSchema = createInsertSchema(imports).omit({ id: true }).extend({
  createdAt: z.string().min(1),
  idempotencyKey: z.string().min(1),
  ruleVersion: z.string().min(1),
});
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof imports.$inferSelect;

export const importFiles = sqliteTable("import_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importId: integer("import_id").notNull().references(() => imports.id),
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
});
export const insertImportFileSchema = createInsertSchema(importFiles).omit({ id: true });
export type InsertImportFile = z.infer<typeof insertImportFileSchema>;
export type ImportFile = typeof importFiles.$inferSelect;

export const rawTransactions = sqliteTable("raw_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importId: integer("import_id").notNull().references(() => imports.id),
  externalId: text("external_id"),
  postedAt: text("posted_at").notNull(),
  descriptionRaw: text("description_raw").notNull(),
  transactionCode: text("transaction_code"),
  amountRaw: text("amount_raw").notNull(),
  amountRawSignHint: text("amount_raw_sign_hint", { enum: ["positive", "negative", "unknown"] })
    .notNull()
    .default("unknown"),
  metadataJson: text("metadata_json").notNull().default("{}"),
});
export const insertRawTransactionSchema = createInsertSchema(rawTransactions).omit({ id: true });
export type InsertRawTransaction = z.infer<typeof insertRawTransactionSchema>;
export type RawTransaction = typeof rawTransactions.$inferSelect;

export const ledgerTransactions = sqliteTable("ledger_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importId: integer("import_id").notNull().references(() => imports.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  postedAt: text("posted_at").notNull(),
  descriptionNormalized: text("description_normalized").notNull(),
  amountRaw: text("amount_raw").notNull(),
  amountNormalized: real("amount_normalized").notNull(),
  fingerprint: text("fingerprint").notNull(),
  kind: text("kind", { enum: ["purchase", "payment", "refund", "transfer", "fee", "interest", "other"] })
    .notNull()
    .default("other"),
  affectsIncomeExpense: integer("affects_income_expense", { mode: "boolean" })
    .notNull()
    .default(true),
  transferGroupId: text("transfer_group_id"),
  duplicateOfId: integer("duplicate_of_id").references((): any => ledgerTransactions.id),
  confidence: real("confidence").notNull().default(0.5),
  ruleVersion: text("rule_version").notNull(),
  auditJson: text("audit_json").notNull().default("{}"),
  needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
  reviewNotes: text("review_notes"),
  updatedAt: text("updated_at").notNull(),
});
export const insertLedgerTransactionSchema = createInsertSchema(ledgerTransactions).omit({ id: true }).extend({
  amountNormalized: z.number(),
});
export type InsertLedgerTransaction = z.infer<typeof insertLedgerTransactionSchema>;
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;

export const ledgerAuditEvents = sqliteTable("ledger_audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  at: text("at").notNull(),
  actor: text("actor", { enum: ["system", "user"] }).notNull().default("system"),
  event: text("event").notNull(),
  diffJson: text("diff_json").notNull().default("{}"),
});
export const insertLedgerAuditEventSchema = createInsertSchema(ledgerAuditEvents).omit({ id: true });
export type InsertLedgerAuditEvent = z.infer<typeof insertLedgerAuditEventSchema>;
export type LedgerAuditEvent = typeof ledgerAuditEvents.$inferSelect;
