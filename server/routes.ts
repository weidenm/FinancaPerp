import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertCategorySchema, insertBudgetSchema, insertGoalSchema } from "@shared/schema";
import { z } from "zod";
import { registerImportRoutes } from "./api/imports";
import { registerAccountRoutes } from "./api/accounts";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Ledger imports (bank statement + card invoice) ────────────
  registerAccountRoutes(app);
  registerImportRoutes(app);

  // ─── Categories ───────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/categories", async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cat = await storage.createCategory(parsed.data);
    res.status(201).json(cat);
  });

  app.delete("/api/categories/:id", async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  // ─── Transactions ─────────────────────────────
  app.get("/api/transactions", async (req, res) => {
    const { startDate, endDate } = req.query;
    const txs = await storage.getTransactions(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(txs);
  });

  app.post("/api/transactions", async (req, res) => {
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const tx = await storage.createTransaction(parsed.data);
    res.status(201).json(tx);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    await storage.deleteTransaction(Number(req.params.id));
    res.status(204).send();
  });

  // ─── Budgets ──────────────────────────────────
  app.get("/api/budgets", async (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const b = await storage.getBudgets(month);
    res.json(b);
  });

  app.post("/api/budgets", async (req, res) => {
    const parsed = insertBudgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = await storage.createBudget(parsed.data);
    res.status(201).json(b);
  });

  app.patch("/api/budgets/:id", async (req, res) => {
    const limitSchema = z.object({ limit: z.number().positive() });
    const parsed = limitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const b = await storage.updateBudget(Number(req.params.id), parsed.data.limit);
    if (!b) return res.status(404).json({ error: "Budget not found" });
    res.json(b);
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    await storage.deleteBudget(Number(req.params.id));
    res.status(204).send();
  });

  // ─── Goals ────────────────────────────────────
  app.get("/api/goals", async (_req, res) => {
    const g = await storage.getGoals();
    res.json(g);
  });

  app.post("/api/goals", async (req, res) => {
    const parsed = insertGoalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const g = await storage.createGoal(parsed.data);
    res.status(201).json(g);
  });

  app.patch("/api/goals/:id", async (req, res) => {
    const updateSchema = z.object({
      name: z.string().optional(),
      targetAmount: z.number().positive().optional(),
      currentAmount: z.number().min(0).optional(),
      deadline: z.string().nullable().optional(),
      icon: z.string().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const g = await storage.updateGoal(Number(req.params.id), parsed.data);
    if (!g) return res.status(404).json({ error: "Goal not found" });
    res.json(g);
  });

  app.delete("/api/goals/:id", async (req, res) => {
    await storage.deleteGoal(Number(req.params.id));
    res.status(204).send();
  });

  // ─── Seed default categories ──────────────────
  app.post("/api/seed", async (_req, res) => {
    const existing = await storage.getCategories();
    if (existing.length > 0) return res.json({ message: "Already seeded" });

    const defaultCategories = [
      { name: "Salário", icon: "banknote", color: "emerald", type: "receita" as const },
      { name: "Freelance", icon: "laptop", color: "teal", type: "receita" as const },
      { name: "Investimentos", icon: "trending-up", color: "blue", type: "receita" as const },
      { name: "Alimentação", icon: "utensils", color: "orange", type: "despesa" as const },
      { name: "Transporte", icon: "car", color: "slate", type: "despesa" as const },
      { name: "Moradia", icon: "home", color: "violet", type: "despesa" as const },
      { name: "Saúde", icon: "heart-pulse", color: "red", type: "despesa" as const },
      { name: "Educação", icon: "graduation-cap", color: "indigo", type: "despesa" as const },
      { name: "Lazer", icon: "gamepad-2", color: "pink", type: "despesa" as const },
      { name: "Outros", icon: "circle-ellipsis", color: "gray", type: "ambos" as const },
    ];

    for (const cat of defaultCategories) {
      await storage.createCategory(cat);
    }
    res.status(201).json({ message: "Seeded" });
  });

  return httpServer;
}
