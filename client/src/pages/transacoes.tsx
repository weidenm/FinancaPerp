import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiRequestFormData } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency, formatDate, getCurrentMonth, getMonthLabel, getLastDayOfMonth } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Transaction, Category, Account } from "@shared/schema";

export default function Transacoes() {
  const { toast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());
  const [open, setOpen] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [importForm, setImportForm] = useState({
    accountId: "",
    sourceKind: "statement" as "statement" | "card_invoice",
    files: null as FileList | null,
  });
  const [showNewAccountOnImport, setShowNewAccountOnImport] = useState(false);
  const [newAccountOnImport, setNewAccountOnImport] = useState({
    name: "",
    type: "checking" as "checking" | "savings" | "credit_card",
  });
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "despesa" as "receita" | "despesa",
    categoryId: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
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

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const createAccountFromImportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounts", {
        name: newAccountOnImport.name.trim(),
        type: newAccountOnImport.type,
        connectorId: "generic_csv",
        signConvention: "natural",
        currency: "BRL",
      });
      return res.json() as Promise<Account>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setImportForm((prev) => ({ ...prev, accountId: String(created.id) }));
      setNewAccountOnImport({ name: "", type: "checking" });
      setShowNewAccountOnImport(false);
      toast({ title: "Conta criada", description: created.name });
    },
    onError: () => {
      toast({ title: "Erro ao criar conta", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/transactions", {
        description: data.description,
        amount: parseFloat(data.amount),
        type: data.type,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        date: data.date,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setOpen(false);
      setForm({
        description: "",
        amount: "",
        type: "despesa",
        categoryId: "",
        date: new Date().toISOString().slice(0, 10),
      });
      toast({ title: "Transação registrada" });
    },
    onError: () => {
      toast({ title: "Erro ao registrar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transação removida" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importForm.accountId || !importForm.files || importForm.files.length === 0) {
        throw new Error("Selecione a conta e ao menos um arquivo");
      }
      const fd = new FormData();
      fd.append("accountId", importForm.accountId);
      fd.append("sourceKind", importForm.sourceKind);
      for (const f of Array.from(importForm.files)) fd.append("files", f);
      const res = await apiRequestFormData("POST", "/api/imports", fd);
      const data = (await res.json()) as {
        importId?: number;
        counts?: { raw?: number; ledger?: number; needsReview?: number };
      };
      const importId = data.importId;
      if (importId == null) throw new Error("Resposta inválida do servidor (sem importId).");
      const commitRes = await apiRequest("POST", `/api/imports/${importId}/commit`);
      const commit = (await commitRes.json()) as {
        created?: number;
        alreadyCommitted?: boolean;
      };
      return { import: data, commit };
    },
    onSuccess: ({ import: data, commit }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setOpenImport(false);
      setImportForm({ accountId: "", sourceKind: "statement", files: null });
      const raw = data?.counts?.raw ?? 0;
      const ledger = data?.counts?.ledger ?? 0;
      const needsReview = data?.counts?.needsReview ?? 0;
      const created = commit?.created ?? 0;
      const already = commit?.alreadyCommitted === true;
      toast({
        title: already ? "Importação já processada" : "Importação concluída",
        description: [
          `Linhas no arquivo: ${raw} · Normalizadas: ${ledger}`,
          needsReview ? `Com alerta de revisão: ${needsReview}` : null,
          already
            ? "Lançamentos já estavam gravados na lista."
            : `Novas transações na lista: ${created} (use o mês da data de cada lançamento para vê-las).`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao importar", description: String(e?.message || ""), variant: "destructive" });
    },
  });

  const filteredCategories = categories.filter(
    (c) => c.type === form.type || c.type === "ambos"
  );

  const navigateMonth = (dir: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir);
    setMonth(d.toISOString().slice(0, 7));
  };

  const receitas = transactions
    .filter((t) => t.type === "receita")
    .reduce((s, t) => s + t.amount, 0);
  const despesas = transactions
    .filter((t) => t.type === "despesa")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-transacoes-title">
            Transações
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(-1)}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground capitalize min-w-[140px] text-center">
              {getMonthLabel(month)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(1)}
              data-testid="button-next-month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={openImport}
            onOpenChange={(o) => {
              setOpenImport(o);
              if (!o) {
                setShowNewAccountOnImport(false);
                setNewAccountOnImport({ name: "", type: "checking" });
                setImportForm({ accountId: "", sourceKind: "statement", files: null });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-import-transactions">
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar arquivos</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  importMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="shrink-0">Conta</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setShowNewAccountOnImport((v) => !v)}
                      data-testid="button-toggle-new-account-import"
                    >
                      {showNewAccountOnImport ? "Fechar" : "Nova conta"}
                    </Button>
                  </div>
                  <Select
                    value={importForm.accountId}
                    onValueChange={(v) => setImportForm({ ...importForm, accountId: v })}
                  >
                    <SelectTrigger data-testid="select-import-account">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showNewAccountOnImport ? (
                    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        A conta usa o formato padrão de arquivos (CSV, OFX, Excel, etc.).
                      </p>
                      <div>
                        <Label className="text-xs">Nome da conta</Label>
                        <Input
                          className="mt-1"
                          value={newAccountOnImport.name}
                          onChange={(e) =>
                            setNewAccountOnImport({ ...newAccountOnImport, name: e.target.value })
                          }
                          placeholder="Ex: Itaú Corrente"
                          data-testid="input-new-account-name-import"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={newAccountOnImport.type}
                          onValueChange={(v) =>
                            setNewAccountOnImport({
                              ...newAccountOnImport,
                              type: v as "checking" | "savings" | "credit_card",
                            })
                          }
                        >
                          <SelectTrigger className="mt-1" data-testid="select-new-account-type-import">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Conta corrente</SelectItem>
                            <SelectItem value="savings">Poupança</SelectItem>
                            <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={
                          createAccountFromImportMutation.isPending || !newAccountOnImport.name.trim()
                        }
                        onClick={() => createAccountFromImportMutation.mutate()}
                        data-testid="button-create-account-import"
                      >
                        {createAccountFromImportMutation.isPending ? "Criando..." : "Criar e selecionar"}
                      </Button>
                    </div>
                  ) : null}
                  {accounts.length === 0 && !showNewAccountOnImport ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma conta cadastrada. Use &quot;Nova conta&quot; acima ou cadastre em outro lugar.
                    </p>
                  ) : null}
                </div>

                <div>
                  <Label>Fonte do arquivo</Label>
                  <Select
                    value={importForm.sourceKind}
                    onValueChange={(v) =>
                      setImportForm({ ...importForm, sourceKind: v as "statement" | "card_invoice" })
                    }
                  >
                    <SelectTrigger data-testid="select-import-source-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="statement">Extrato (conta corrente / poupança)</SelectItem>
                      <SelectItem value="card_invoice">Fatura de cartão de crédito</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O tipo de arquivo (CSV, OFX, Excel…) é detectado automaticamente.
                  </p>
                </div>

                <div>
                  <Label>Arquivos</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setImportForm({ ...importForm, files: e.target.files })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Suporta CSV, XLSX, OFX, PDF, TXT e imagens (OCR). Lançamentos classificados como
                    receita ou despesa entram na lista; transferências e pagamento de fatura não.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={importMutation.isPending}>
                  {importMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-transaction">
                <Plus className="size-4 mr-1.5" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.description || !form.amount) return;
                  createMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) =>
                        setForm({ ...form, type: v as "receita" | "despesa", categoryId: "" })
                      }
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      data-testid="input-date"
                    />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Ex: Supermercado"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    data-testid="input-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      data-testid="input-amount"
                    />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={form.categoryId}
                      onValueChange={(v) => setForm({ ...form, categoryId: v })}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-transaction"
                >
                  {createMutation.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Receitas</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(receitas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Despesas</p>
            <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(despesas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Saldo do Mês</p>
            <p
              className={`text-lg font-bold tabular-nums ${receitas - despesas >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatCurrency(receitas - despesas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {transactions.length} {transactions.length === 1 ? "transação" : "transações"} no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma transação neste mês
            </p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3"
                    data-testid={`row-transaction-${tx.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-9 rounded-md flex items-center justify-center shrink-0 ${tx.type === "receita" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}
                      >
                        {tx.type === "receita" ? (
                          <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="size-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat?.name || "Outros"} · {formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm font-semibold tabular-nums ${tx.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {tx.type === "receita" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(tx.id)}
                        data-testid={`button-delete-${tx.id}`}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
