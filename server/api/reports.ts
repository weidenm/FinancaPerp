import type { Express } from "express";
import { storage } from "../storage";

function getLastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0);
  return last.toISOString().slice(0, 10);
}

export function registerReportRoutes(app: Express) {
  /**
   * GET /api/reports/monthly-summary?year=YYYY
   *
   * Returns one row per month (YYYY-MM) with:
   *   { month, receitas, despesas, saldo, savingsRate }
   */
  app.get("/api/reports/monthly-summary", async (req, res) => {
    const year = String(req.query.year || new Date().getFullYear());
    const months: string[] = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      return `${year}-${m}`;
    });

    const rows = await Promise.all(
      months.map(async (month) => {
        const start = `${month}-01`;
        const end = getLastDayOfMonth(month);
        const txs = await storage.getTransactions(start, end);
        const receitas = txs
          .filter((t) => t.type === "receita")
          .reduce((s, t) => s + t.amount, 0);
        const despesas = txs
          .filter((t) => t.type === "despesa")
          .reduce((s, t) => s + t.amount, 0);
        const saldo = receitas - despesas;
        const savingsRate = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;
        return { month, receitas, despesas, saldo, savingsRate };
      })
    );

    res.json(rows);
  });

  /**
   * GET /api/reports/category-breakdown?year=YYYY&month=YYYY-MM
   *
   * Returns expense totals per category for the given month.
   *   [{ categoryId, categoryName, total, pct }]
   */
  app.get("/api/reports/category-breakdown", async (req, res) => {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const start = `${month}-01`;
    const end = getLastDayOfMonth(month);
    const [txs, cats] = await Promise.all([
      storage.getTransactions(start, end),
      storage.getCategories(),
    ]);

    const totals: Record<string, number> = {};
    for (const tx of txs) {
      if (tx.type !== "despesa") continue;
      const key = String(tx.categoryId ?? "null");
      totals[key] = (totals[key] || 0) + tx.amount;
    }

    const grand = Object.values(totals).reduce((s, v) => s + v, 0);

    const rows = Object.entries(totals)
      .map(([k, total]) => {
        const catId = k === "null" ? null : Number(k);
        const cat = catId !== null ? cats.find((c) => c.id === catId) : undefined;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? "Sem categoria",
          categoryColor: cat?.color ?? "gray",
          total,
          pct: grand > 0 ? (total / grand) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    res.json(rows);
  });

  /**
   * GET /api/reports/top-categories?months=6
   *
   * Returns the top expense categories across the last N months,
   * useful for a "where did my money go" summary.
   */
  app.get("/api/reports/top-categories", async (req, res) => {
    const n = Math.min(Math.max(parseInt(String(req.query.months || "6")), 1), 24);
    const today = new Date();
    const months: string[] = Array.from({ length: n }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1);
      return d.toISOString().slice(0, 7);
    });

    const [cats] = await Promise.all([storage.getCategories()]);
    const totals: Record<string, number> = {};

    for (const month of months) {
      const start = `${month}-01`;
      const end = getLastDayOfMonth(month);
      const txs = await storage.getTransactions(start, end);
      for (const tx of txs) {
        if (tx.type !== "despesa") continue;
        const key = String(tx.categoryId ?? "null");
        totals[key] = (totals[key] || 0) + tx.amount;
      }
    }

    const grand = Object.values(totals).reduce((s, v) => s + v, 0);
    const rows = Object.entries(totals)
      .map(([k, total]) => {
        const catId = k === "null" ? null : Number(k);
        const cat = catId !== null ? cats.find((c) => c.id === catId) : undefined;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? "Sem categoria",
          categoryColor: cat?.color ?? "gray",
          total,
          pct: grand > 0 ? (total / grand) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    res.json(rows);
  });
}
