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
