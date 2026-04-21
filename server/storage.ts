import {
  type Category, type InsertCategory, categories,
  type Transaction, type InsertTransaction, transactions,
  type Budget, type InsertBudget, budgets,
  type Goal, type InsertGoal, goals,
} from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "./infra/db";

export interface MonthlySummary {
  month: string; // YYYY-MM
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(cat: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  // Transactions
  getTransactions(startDate?: string, endDate?: string): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<void>;

  // Budgets
  getBudgets(month: string): Promise<Budget[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, limit: number): Promise<Budget | undefined>;
  deleteBudget(id: number): Promise<void>;
  copyBudgets(fromMonth: string, toMonth: string): Promise<{ copied: number; skipped: number }>;

  // Summary
  getMonthlySummary(months: number): Promise<MonthlySummary[]>;

  // Goals
  getGoals(): Promise<Goal[]>;
  getGoal(id: number): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).all();
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return await db.select().from(categories).where(eq(categories.id, id)).get();
  }

  async createCategory(cat: InsertCategory): Promise<Category> {
    return await db.insert(categories).values(cat).returning().get();
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    return await db.update(categories).set(updates).where(eq(categories.id, id)).returning().get();
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id)).run();
  }

  // Transactions
  async getTransactions(startDate?: string, endDate?: string): Promise<Transaction[]> {
    if (startDate && endDate) {
      return await db.select().from(transactions)
        .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
        .orderBy(desc(transactions.date))
        .all();
    }
    return await db.select().from(transactions).orderBy(desc(transactions.date)).all();
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return await db.select().from(transactions).where(eq(transactions.id, id)).get();
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    return await db.insert(transactions).values(tx).returning().get();
  }

  async updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    return await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning().get();
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id)).run();
  }

  // Budgets
  async getBudgets(month: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.month, month)).all();
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    return await db.insert(budgets).values(budget).returning().get();
  }

  async updateBudget(id: number, limit: number): Promise<Budget | undefined> {
    return await db.update(budgets).set({ limit }).where(eq(budgets.id, id)).returning().get();
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id)).run();
  }

  async copyBudgets(fromMonth: string, toMonth: string): Promise<{ copied: number; skipped: number }> {
    const source = await db.select().from(budgets).where(eq(budgets.month, fromMonth)).all();
    if (source.length === 0) return { copied: 0, skipped: 0 };

    const existing = await db.select().from(budgets).where(eq(budgets.month, toMonth)).all();
    const existingCatIds = new Set(existing.map((b) => b.categoryId));

    let copied = 0;
    let skipped = 0;
    for (const b of source) {
      if (existingCatIds.has(b.categoryId)) {
        skipped++;
      } else {
        await db.insert(budgets).values({ categoryId: b.categoryId, limit: b.limit, month: toMonth }).run();
        copied++;
      }
    }
    return { copied, skipped };
  }

  async getMonthlySummary(months: number): Promise<MonthlySummary[]> {
    const result: MonthlySummary[] = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const month = d.toISOString().slice(0, 7);
      const startDate = `${month}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

      const rows = await db
        .select()
        .from(transactions)
        .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
        .all();

      const receitas = rows.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
      const despesas = rows.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
      result.push({ month, receitas, despesas, saldo: receitas - despesas });
    }

    return result;
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    return await db.select().from(goals).all();
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    return await db.select().from(goals).where(eq(goals.id, id)).get();
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    return await db.insert(goals).values(goal).returning().get();
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined> {
    return await db.update(goals).set(updates).where(eq(goals.id, id)).returning().get();
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
