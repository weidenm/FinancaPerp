import type { Express } from "express";
import { z } from "zod";
import { insertAccountSchema } from "@shared/schema";
import { createAccountRow, deleteAccountRow, listAccounts, updateAccountRow } from "../infra/ledgerRepo";

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

  app.patch("/api/accounts/:id", async (req, res) => {
    const id = Number(req.params.id);
    const patchSchema = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(["checking", "savings", "credit_card"]).optional(),
      connectorId: z.string().min(1).optional(),
      signConvention: z.enum(["natural", "inverted"]).optional(),
      currency: z.string().min(1).optional(),
      treatPixAsExpense: z.boolean().optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await updateAccountRow(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Account not found" });
    res.json(updated);
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    await deleteAccountRow(Number(req.params.id));
    res.status(204).send();
  });
}


