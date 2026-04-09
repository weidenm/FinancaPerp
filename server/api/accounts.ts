import type { Express } from "express";
import { insertAccountSchema } from "@shared/schema";
import { createAccountRow, listAccounts } from "../infra/ledgerRepo";

export function registerAccountRoutes(app: Express) {
  app.get("/api/accounts", async (_req, res) => {
    res.json(await listAccounts());
  });

  app.post("/api/accounts", async (req, res) => {
    const parsed = insertAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const created = await createAccountRow(parsed.data as any);
    res.status(201).json(created);
  });
}

