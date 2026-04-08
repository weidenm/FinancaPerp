import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Target, TrendingUp, PiggyBank, Gem, Gift, Plane } from "lucide-react";
import type { Goal } from "@shared/schema";

const GOAL_ICONS: Record<string, typeof Target> = {
  target: Target,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  gem: Gem,
  gift: Gift,
  plane: Plane,
};

const GOAL_ICON_ENTRIES = Object.entries(GOAL_ICONS) as [string, typeof Target][];

export default function Metas() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [depositDialog, setDepositDialog] = useState<Goal | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "0",
    deadline: "",
    icon: "target",
  });

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/goals", {
        name: data.name,
        targetAmount: parseFloat(data.targetAmount),
        currentAmount: parseFloat(data.currentAmount) || 0,
        deadline: data.deadline || null,
        icon: data.icon,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setOpen(false);
      setForm({ name: "", targetAmount: "", currentAmount: "0", deadline: "", icon: "target" });
      toast({ title: "Meta criada" });
    },
    onError: () => {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, currentAmount }: { id: number; currentAmount: number }) => {
      const res = await apiRequest("PATCH", `/api/goals/${id}`, { currentAmount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setDepositDialog(null);
      setDepositAmount("");
      toast({ title: "Depósito registrado" });
    },
    onError: () => {
      toast({ title: "Erro ao registrar depósito", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Meta removida" });
    },
  });

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-metas-title">
            Metas Financeiras
          </h2>
          <p className="text-sm text-muted-foreground">
            {goals.length} meta{goals.length !== 1 ? "s" : ""} · {formatCurrency(totalCurrent)} /{" "}
            {formatCurrency(totalTarget)}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-goal">
              <Plus className="size-4 mr-1.5" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Meta</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name || !form.targetAmount) return;
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Reserva de emergência"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-goal-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor Alvo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="10000"
                    value={form.targetAmount}
                    onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                    data-testid="input-goal-target"
                  />
                </div>
                <div>
                  <Label>Já guardado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={form.currentAmount}
                    onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                    data-testid="input-goal-current"
                  />
                </div>
              </div>
              <div>
                <Label>Prazo (opcional)</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  data-testid="input-goal-deadline"
                />
              </div>
              <div>
                <Label>Ícone</Label>
                <div className="grid grid-cols-6 gap-2 mt-1.5" data-testid="goal-icon-picker">
                  {GOAL_ICON_ENTRIES.map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, icon: key })}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md border transition-colors",
                        form.icon === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                      )}
                      aria-label={`Ícone ${key}`}
                      aria-pressed={form.icon === key}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
                data-testid="button-submit-goal"
              >
                {createMutation.isPending ? "Salvando..." : "Criar Meta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Defina metas financeiras para acompanhar seu progresso
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct =
              goal.targetAmount > 0
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
            const remaining = goal.targetAmount - goal.currentAmount;
            const Icon = GOAL_ICONS[goal.icon] || Target;
            return (
              <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{goal.name}</p>
                        {goal.deadline && (
                          <p className="text-[11px] text-muted-foreground">
                            Prazo: {new Date(goal.deadline + "T12:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(goal.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {pct.toFixed(0)}% alcançado
                      {remaining > 0 && ` · Faltam ${formatCurrency(remaining)}`}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setDepositDialog(goal);
                      setDepositAmount("");
                    }}
                    data-testid={`button-deposit-${goal.id}`}
                  >
                    <Plus className="size-3.5 mr-1" />
                    Depositar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deposit dialog */}
      <Dialog open={!!depositDialog} onOpenChange={(o) => !o && setDepositDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depositar em "{depositDialog?.name}"</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!depositDialog || !depositAmount) return;
              updateMutation.mutate({
                id: depositDialog.id,
                currentAmount: depositDialog.currentAmount + parseFloat(depositAmount),
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Valor do Depósito (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                data-testid="input-deposit-amount"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending}
              data-testid="button-submit-deposit"
            >
              {updateMutation.isPending ? "Salvando..." : "Confirmar Depósito"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
