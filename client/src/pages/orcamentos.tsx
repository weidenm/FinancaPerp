import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, getCurrentMonth, getMonthLabel, getLastDayOfMonth } from "@/lib/utils";
import {
  Plus,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import type { Budget, Transaction, Category } from "@shared/schema";

export default function Orcamentos() {
  const { toast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ categoryId: "", limit: "" });
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [editLimit, setEditLimit] = useState("");

  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets", month],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/budgets?month=${month}`);
      return res.json();
    },
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", month],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/transactions?startDate=${startDate}&endDate=${endDate}`
      );
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/budgets", {
        categoryId: parseInt(data.categoryId),
        limit: parseFloat(data.limit),
        month,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setOpen(false);
      setForm({ categoryId: "", limit: "" });
      toast({ title: "Orçamento criado" });
    },
    onError: () => {
      toast({ title: "Erro ao criar orçamento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Orçamento removido" });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: async ({ id, limit }: { id: number; limit: number }) => {
      const res = await apiRequest("PATCH", `/api/budgets/${id}`, { limit });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setEditBudget(null);
      setEditLimit("");
      toast({ title: "Limite atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar limite", variant: "destructive" });
    },
  });

  const dataLoading = budgetsLoading || txLoading;

  const navigateMonth = (dir: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir);
    setMonth(d.toISOString().slice(0, 7));
  };

  const expenseCategories = categories.filter(
    (c) => c.type === "despesa" || c.type === "ambos"
  );

  // Categories not yet budgeted
  const budgetedCatIds = budgets.map((b) => b.categoryId);
  const availableCategories = expenseCategories.filter(
    (c) => !budgetedCatIds.includes(c.id)
  );

  const getSpent = (categoryId: number) =>
    transactions
      .filter((t) => t.type === "despesa" && t.categoryId === categoryId)
      .reduce((s, t) => s + t.amount, 0);

  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + getSpent(b.categoryId), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-orcamentos-title">
            Orçamentos
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground capitalize min-w-[140px] text-center">
              {getMonthLabel(month)}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-add-budget"
              disabled={availableCategories.length === 0}
            >
              <Plus className="size-4 mr-1.5" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.categoryId || !form.limit) return;
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger data-testid="select-budget-category">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Limite (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  data-testid="input-budget-limit"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
                data-testid="button-submit-budget"
              >
                {createMutation.isPending ? "Salvando..." : "Criar Orçamento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total overview */}
      <Card>
        <CardContent className="p-4">
          {dataLoading ? (
            <p className="text-sm text-muted-foreground py-2">Carregando...</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium">Total Orçado vs Gasto</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
                </p>
              </div>
              <Progress
                value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
                className="h-3"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Budget cards */}
      {dataLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Carregando orçamentos...</p>
          </CardContent>
        </Card>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum orçamento definido para este mês
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const cat = categories.find((c) => c.id === budget.categoryId);
            const spent = getSpent(budget.categoryId);
            const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
            const overBudget = pct > 100;
            return (
              <Card key={budget.id} data-testid={`card-budget-${budget.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {overBudget && (
                        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                      )}
                      <p className="text-sm font-semibold">{cat?.name || "Outros"}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditBudget(budget);
                          setEditLimit(String(budget.limit));
                        }}
                        data-testid={`button-edit-budget-${budget.id}`}
                        aria-label="Editar limite"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(budget.id)}
                        aria-label="Remover orçamento"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Gasto: {formatCurrency(spent)}</span>
                      <span>Limite: {formatCurrency(budget.limit)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p
                    className={`text-xs font-medium tabular-nums ${overBudget ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                  >
                    {pct.toFixed(0)}% utilizado
                    {overBudget && ` (${formatCurrency(spent - budget.limit)} acima)`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editBudget}
        onOpenChange={(o) => {
          if (!o) {
            setEditBudget(null);
            setEditLimit("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar limite — {categories.find((c) => c.id === editBudget?.categoryId)?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editBudget || !editLimit) return;
              const limit = parseFloat(editLimit);
              if (limit <= 0) return;
              updateLimitMutation.mutate({ id: editBudget.id, limit });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Novo limite (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                data-testid="input-edit-budget-limit"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateLimitMutation.isPending}>
              {updateLimitMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
