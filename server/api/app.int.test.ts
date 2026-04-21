/**
 * Integration tests for the classic finance API:
 *   - /api/categories (CRUD + seed)
 *   - /api/budgets (CRUD + copy)
 *   - /api/goals (CRUD + deposit)
 *   - /api/transactions/summary
 *   - /api/transactions/export
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db } from "../infra/db";
import { categories, budgets, goals, transactions } from "@shared/schema";

let app: any;

beforeAll(async () => {
  // Clean state before this suite
  await db.delete(transactions).run();
  await db.delete(budgets).run();
  await db.delete(goals).run();
  await db.delete(categories).run();

  const mod = await import("../app");
  const created = await mod.createApp();
  app = created.app;
});

afterAll(async () => {
  await db.delete(transactions).run();
  await db.delete(budgets).run();
  await db.delete(goals).run();
  await db.delete(categories).run();
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe("categories API", () => {
  let catId: number;

  it("POST /api/seed creates default categories (201 first time)", async () => {
    const res = await request(app).post("/api/seed");
    // 201 first time, 200 if already seeded; both are acceptable
    expect([200, 201]).toContain(res.status);
    const cats = await request(app).get("/api/categories").expect(200);
    expect(cats.body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/categories creates a new category", async () => {
    const res = await request(app)
      .post("/api/categories")
      .send({ name: "Streaming", icon: "play", color: "purple", type: "despesa" })
      .expect(201);
    expect(res.body.name).toBe("Streaming");
    expect(res.body.type).toBe("despesa");
    catId = res.body.id;
  });

  it("GET /api/categories lists all categories", async () => {
    const res = await request(app).get("/api/categories").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: any) => c.id === catId)).toBe(true);
  });

  it("PATCH /api/categories/:id updates name and color", async () => {
    const res = await request(app)
      .patch(`/api/categories/${catId}`)
      .send({ name: "Streaming & TV", color: "blue" })
      .expect(200);
    expect(res.body.name).toBe("Streaming & TV");
    expect(res.body.color).toBe("blue");
  });

  it("PATCH /api/categories/:id returns 400 on invalid body", async () => {
    await request(app)
      .patch(`/api/categories/${catId}`)
      .send({ type: "invalid_type" })
      .expect(400);
  });

  it("DELETE /api/categories/:id removes the category", async () => {
    await request(app).delete(`/api/categories/${catId}`).expect(204);
    const cats = await request(app).get("/api/categories").expect(200);
    expect(cats.body.find((c: any) => c.id === catId)).toBeUndefined();
  });
});

// ─── Budgets ──────────────────────────────────────────────────────────────────

describe("budgets API", () => {
  let budgetId: number;
  let testCatId: number;

  beforeAll(async () => {
    // Create a fresh category for budget tests
    const res = await request(app)
      .post("/api/categories")
      .send({ name: "Alimentação Test", icon: "utensils", color: "orange", type: "despesa" });
    testCatId = res.body.id;
  });

  it("POST /api/budgets creates a budget", async () => {
    const res = await request(app)
      .post("/api/budgets")
      .send({ categoryId: testCatId, limit: 800, month: "2026-01" })
      .expect(201);
    expect(res.body.limit).toBe(800);
    expect(res.body.month).toBe("2026-01");
    budgetId = res.body.id;
  });

  it("GET /api/budgets?month returns budgets for month", async () => {
    const res = await request(app).get("/api/budgets?month=2026-01").expect(200);
    expect(res.body.some((b: any) => b.id === budgetId)).toBe(true);
  });

  it("PATCH /api/budgets/:id updates limit", async () => {
    const res = await request(app)
      .patch(`/api/budgets/${budgetId}`)
      .send({ limit: 1000 })
      .expect(200);
    expect(res.body.limit).toBe(1000);
  });

  it("POST /api/budgets/copy copies to target month", async () => {
    const res = await request(app)
      .post("/api/budgets/copy")
      .send({ fromMonth: "2026-01", toMonth: "2026-05" })
      .expect(200);
    expect(res.body.copied).toBe(1);
    expect(res.body.skipped).toBe(0);
    const may = await request(app).get("/api/budgets?month=2026-05");
    expect(may.body.some((b: any) => b.categoryId === testCatId && b.limit === 1000)).toBe(true);
  });

  it("POST /api/budgets/copy skips existing categories", async () => {
    const res = await request(app)
      .post("/api/budgets/copy")
      .send({ fromMonth: "2026-01", toMonth: "2026-05" })
      .expect(200);
    expect(res.body.copied).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it("POST /api/budgets/copy returns 400 for invalid month format", async () => {
    await request(app)
      .post("/api/budgets/copy")
      .send({ fromMonth: "Jan 2026", toMonth: "2026-05" })
      .expect(400);
  });

  it("DELETE /api/budgets/:id removes the budget", async () => {
    await request(app).delete(`/api/budgets/${budgetId}`).expect(204);
    const jan = await request(app).get("/api/budgets?month=2026-01");
    expect(jan.body.find((b: any) => b.id === budgetId)).toBeUndefined();
  });
});

// ─── Goals ────────────────────────────────────────────────────────────────────

describe("goals API", () => {
  let goalId: number;

  it("POST /api/goals creates a goal", async () => {
    const res = await request(app)
      .post("/api/goals")
      .send({ name: "Reserva de emergência", targetAmount: 10000, currentAmount: 500, icon: "piggy-bank" })
      .expect(201);
    expect(res.body.name).toBe("Reserva de emergência");
    expect(res.body.targetAmount).toBe(10000);
    goalId = res.body.id;
  });

  it("GET /api/goals lists all goals", async () => {
    const res = await request(app).get("/api/goals").expect(200);
    expect(res.body.some((g: any) => g.id === goalId)).toBe(true);
  });

  it("PATCH /api/goals/:id deposits (updates currentAmount)", async () => {
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .send({ currentAmount: 1500 })
      .expect(200);
    expect(res.body.currentAmount).toBe(1500);
  });

  it("PATCH /api/goals/:id can update name and deadline", async () => {
    const res = await request(app)
      .patch(`/api/goals/${goalId}`)
      .send({ name: "Fundo de emergência", deadline: "2026-12-31" })
      .expect(200);
    expect(res.body.name).toBe("Fundo de emergência");
    expect(res.body.deadline).toBe("2026-12-31");
  });

  it("POST /api/goals returns 400 on missing name", async () => {
    await request(app)
      .post("/api/goals")
      .send({ targetAmount: 1000 })
      .expect(400);
  });

  it("DELETE /api/goals/:id removes the goal", async () => {
    await request(app).delete(`/api/goals/${goalId}`).expect(204);
    const res = await request(app).get("/api/goals");
    expect(res.body.find((g: any) => g.id === goalId)).toBeUndefined();
  });
});

// ─── Transactions summary + export ────────────────────────────────────────────

describe("transactions summary and export", () => {
  let txCatId: number;

  beforeAll(async () => {
    // Create category and transactions for this suite
    const catRes = await request(app)
      .post("/api/categories")
      .send({ name: "Salário Test", icon: "banknote", color: "emerald", type: "receita" });
    txCatId = catRes.body.id;

    await request(app)
      .post("/api/transactions")
      .send({ description: "Salário", amount: 5000, type: "receita", date: "2026-04-01", categoryId: txCatId });
    await request(app)
      .post("/api/transactions")
      .send({ description: "Aluguel", amount: 1500, type: "despesa", date: "2026-04-05" });
  });

  it("GET /api/transactions/summary returns N months with correct totals", async () => {
    const res = await request(app).get("/api/transactions/summary?months=3").expect(200);
    expect(res.body).toHaveLength(3);
    const april = res.body.find((s: any) => s.month === "2026-04");
    expect(april).toBeDefined();
    expect(april.receitas).toBe(5000);
    expect(april.despesas).toBe(1500);
    expect(april.saldo).toBe(3500);
  });

  it("GET /api/transactions/summary defaults to 6 months", async () => {
    const res = await request(app).get("/api/transactions/summary").expect(200);
    expect(res.body).toHaveLength(6);
  });

  it("GET /api/transactions/export returns CSV with BOM and correct headers", async () => {
    const res = await request(app)
      .get("/api/transactions/export?format=csv&startDate=2026-04-01&endDate=2026-04-30")
      .expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/\.csv/);
    const text: string = res.text;
    // BOM character at position 0
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Data,Descrição,Tipo,Valor,Categoria");
    expect(text).toContain("Salário");
    expect(text).toContain("receita");
  });

  it("GET /api/transactions/export returns 400 for unsupported format", async () => {
    await request(app)
      .get("/api/transactions/export?format=json")
      .expect(400);
  });
});
