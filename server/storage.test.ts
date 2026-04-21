import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseStorage } from "./storage";
import { db } from "./infra/db";
import { budgets, transactions, categories } from "@shared/schema";

const store = new DatabaseStorage();

beforeEach(async () => {
  await db.delete(budgets).run();
  await db.delete(transactions).run();
  await db.delete(categories).run();
});

describe("copyBudgets", () => {
  it("copies budgets from one month to another", async () => {
    const cat = await store.createCategory({
      name: "Alimentação",
      icon: "circle",
      color: "orange",
      type: "despesa",
    });
    await store.createBudget({ categoryId: cat.id, limit: 500, month: "2026-03" });

    const result = await store.copyBudgets("2026-03", "2026-04");
    expect(result.copied).toBe(1);
    expect(result.skipped).toBe(0);

    const april = await store.getBudgets("2026-04");
    expect(april).toHaveLength(1);
    expect(april[0].categoryId).toBe(cat.id);
    expect(april[0].limit).toBe(500);
    expect(april[0].month).toBe("2026-04");
  });

  it("skips categories already budgeted in the target month", async () => {
    const cat = await store.createCategory({
      name: "Transporte",
      icon: "circle",
      color: "slate",
      type: "despesa",
    });
    await store.createBudget({ categoryId: cat.id, limit: 200, month: "2026-03" });
    await store.createBudget({ categoryId: cat.id, limit: 300, month: "2026-04" });

    const result = await store.copyBudgets("2026-03", "2026-04");
    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(1);

    const april = await store.getBudgets("2026-04");
    expect(april[0].limit).toBe(300);
  });

  it("returns zeros when source month has no budgets", async () => {
    const result = await store.copyBudgets("2025-01", "2026-04");
    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe("getMonthlySummary", () => {
  it("returns N months and sums receitas/despesas correctly", async () => {
    const today = new Date();
    const ym = today.toISOString().slice(0, 7);

    await store.createTransaction({
      description: "Salário",
      amount: 3000,
      type: "receita",
      date: `${ym}-01`,
    });
    await store.createTransaction({
      description: "Aluguel",
      amount: 1200,
      type: "despesa",
      date: `${ym}-05`,
    });
    await store.createTransaction({
      description: "Mercado",
      amount: 400,
      type: "despesa",
      date: `${ym}-10`,
    });

    const summary = await store.getMonthlySummary(3);
    expect(summary).toHaveLength(3);

    const current = summary.find((s) => s.month === ym);
    expect(current).toBeDefined();
    expect(current!.receitas).toBe(3000);
    expect(current!.despesas).toBe(1600);
    expect(current!.saldo).toBe(1400);
  });

  it("returns empty months with zero values", async () => {
    const summary = await store.getMonthlySummary(2);
    expect(summary).toHaveLength(2);
    for (const s of summary) {
      expect(s.receitas).toBe(0);
      expect(s.despesas).toBe(0);
      expect(s.saldo).toBe(0);
    }
  });
});
