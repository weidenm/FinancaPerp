import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertCategorySchema, insertBudgetSchema, insertGoalSchema } from "@shared/schema";
import { z } from "zod";
import { registerImportRoutes } from "./api/imports";
import { registerAccountRoutes } from "./api/accounts";
import { registerReportRoutes } from "./api/reports";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Ledger imports (bank statement + card invoice) ────────────
  registerAccountRoutes(app);
  registerImportRoutes(app);

  // ─── Reports ──────────────────────────────────
  registerReportRoutes(app);

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

  app.patch("/api/categories/:id", async (req, res) => {
    const patchSchema = insertCategorySchema.partial();
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cat = await storage.updateCategory(Number(req.params.id), parsed.data);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  });

  app.delete("/api/categories/:id", async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  /**
   * GET /api/categories/suggest?description=...&type=despesa|receita
   *
   * Returns the best matching category id (or null) based on keyword matching
   * between the description and category names / known keyword mappings.
   */
  app.get("/api/categories/suggest", async (req, res) => {
    const description = String(req.query.description || "").toLowerCase().trim();
    const type = req.query.type as "receita" | "despesa" | undefined;

    if (!description) return res.json({ categoryId: null });

    const cats = await storage.getCategories();
    const filtered = type
      ? cats.filter((c) => c.type === type || c.type === "ambos")
      : cats;

    // keyword → category name mappings for common PT-BR transactions
    const keywordMap: Record<string, string[]> = {
      "Alimentação": ["mercado", "supermercado", "restaurante", "lanche", "comida", "padaria", "ifood", "delivery", "açougue", "hortifruti", "alimento"],
      "Transporte": ["uber", "99", "taxi", "táxi", "gasolina", "combustível", "estacionamento", "pedágio", "ônibus", "metrô", "passagem", "combustivel"],
      "Moradia": ["aluguel", "condomínio", "condominio", "agua", "luz", "energia", "gás", "gas", "internet", "telefone", "iptu"],
      "Saúde": ["farmácia", "farmacia", "remédio", "remedio", "consulta", "médico", "medico", "hospital", "exame", "plano de saúde", "dentista"],
      "Educação": ["escola", "faculdade", "curso", "livro", "material", "mensalidade", "ensino"],
      "Lazer": ["netflix", "spotify", "cinema", "show", "ingresso", "viagem", "hotel", "passagem aérea", "jogo"],
      "Salário": ["salário", "salario", "pagamento", "holerite", "contra-cheque", "contracheque"],
      "Freelance": ["freelance", "serviço", "servico", "projeto", "consultoria"],
      "Investimentos": ["investimento", "dividendo", "rendimento", "cdb", "tesouro", "ação", "fundo"],
    };

    let bestCat: (typeof cats)[0] | null = null;
    let bestScore = 0;

    for (const cat of filtered) {
      let score = 0;

      // Direct name match
      if (description.includes(cat.name.toLowerCase())) {
        score += 10;
      }

      // Keyword map match
      const keywords = keywordMap[cat.name] ?? [];
      for (const kw of keywords) {
        if (description.includes(kw)) {
          score += 5;
          break;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCat = cat;
      }
    }

    res.json({ categoryId: bestCat?.id ?? null, categoryName: bestCat?.name ?? null });
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

  app.patch("/api/transactions/:id", async (req, res) => {
    const patchSchema = z.object({
      description: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      type: z.enum(["receita", "despesa"]).optional(),
      categoryId: z.number().int().positive().nullable().optional(),
      date: z.string().min(1).optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const tx = await storage.updateTransaction(Number(req.params.id), parsed.data as any);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    res.json(tx);
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

  /**
   * POST /api/budgets/copy-from-month
   * Body: { fromMonth: "YYYY-MM", toMonth: "YYYY-MM" }
   *
   * Copies all budgets from `fromMonth` to `toMonth`, skipping categories that
   * already have a budget in `toMonth`.
   */
  app.post("/api/budgets/copy-from-month", async (req, res) => {
    const schema = z.object({
      fromMonth: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
      toMonth: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { fromMonth, toMonth } = parsed.data;

    const [source, existing] = await Promise.all([
      storage.getBudgets(fromMonth),
      storage.getBudgets(toMonth),
    ]);

    const existingCatIds = new Set(existing.map((b) => b.categoryId));
    const toCreate = source.filter((b) => !existingCatIds.has(b.categoryId));

    const created = await Promise.all(
      toCreate.map((b) =>
        storage.createBudget({ categoryId: b.categoryId, limit: b.limit, month: toMonth })
      )
    );

    res.json({ created: created.length, skipped: source.length - created.length, budgets: created });
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
