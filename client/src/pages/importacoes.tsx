import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Tag,
  GitCommit,
  RotateCcw,
} from "lucide-react";
import type { Category, LedgerTransaction, Transaction } from "@shared/schema";

interface ImportSummary {
  id: number;
  createdAt: string;
  accountId: number;
  accountName: string | null;
  accountType: string | null;
  sourceKind: "statement" | "card_invoice";
  connectorId: string;
  ruleVersion: string;
  status: "parsed" | "needs_review" | "committed" | "failed";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  parsed: { label: "Pronto", icon: Clock, variant: "secondary" },
  needs_review: { label: "Revisar", icon: AlertTriangle, variant: "default" },
  committed: { label: "Commitado", icon: CheckCircle2, variant: "outline" },
  failed: { label: "Falhou", icon: XCircle, variant: "destructive" },
};

const KIND_LABELS: Record<string, string> = {
  purchase: "Compra",
  payment: "Pagamento",
  refund: "Estorno",
  transfer: "Transferência",
  fee: "Tarifa",
  interest: "Juros",
  other: "Outro",
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  statement: "Extrato",
  card_invoice: "Fatura",
};

export default function Importacoes() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewImportId, setReviewImportId] = useState<number | null>(null);
  const [categorizeImportId, setCategorizeImportId] = useState<number | null>(null);

  const { data: imports = [], isLoading } = useQuery<ImportSummary[]>({
    queryKey: ["/api/imports"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const commitMutation = useMutation({
    mutationFn: async (importId: number) => {
      const res = await apiRequest("POST", `/api/imports/${importId}/commit`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      if (data.alreadyCommitted) {
        toast({ title: "Já commitado", description: "Este import já havia sido commitado." });
      } else {
        toast({
          title: "Commit realizado",
          description: `${data.created} transaç${data.created === 1 ? "ão lançada" : "ões lançadas"} na lista.`,
        });
      }
    },
    onError: () => toast({ title: "Erro ao commitar", variant: "destructive" }),
  });

  const reprocessMutation = useMutation({
    mutationFn: async (importId: number) => {
      const res = await apiRequest("POST", `/api/imports/${importId}/reprocess`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
      toast({ title: "Reprocessado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao reprocessar", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando importações...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-importacoes-title">
          Importações
        </h2>
        <p className="text-sm text-muted-foreground">
          {imports.length} import{imports.length !== 1 ? "s" : ""} · histórico completo
        </p>
      </div>

      {imports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCommit className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma importação ainda. Use o botão "Importar" na tela de Transações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => {
            const cfg = STATUS_CONFIG[imp.status] ?? STATUS_CONFIG.parsed;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === imp.id;

            return (
              <Card key={imp.id} data-testid={`card-import-${imp.id}`}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : imp.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? "Recolher" : "Expandir"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {imp.accountName ?? `Conta #${imp.accountId}`}
                          <span className="text-muted-foreground font-normal ml-1.5">
                            · {SOURCE_KIND_LABELS[imp.sourceKind]}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(imp.createdAt).toLocaleString("pt-BR")}
                          <span className="ml-1.5">· {imp.ruleVersion}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Badge variant={cfg.variant} className="gap-1">
                        <StatusIcon className="size-3" />
                        {cfg.label}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setReviewImportId(imp.id)}
                        data-testid={`button-review-${imp.id}`}
                      >
                        <Eye className="size-3" />
                        Revisar
                      </Button>

                      {imp.status !== "committed" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => commitMutation.mutate(imp.id)}
                          disabled={commitMutation.isPending}
                          data-testid={`button-commit-${imp.id}`}
                        >
                          <GitCommit className="size-3" />
                          Commitar
                        </Button>
                      )}

                      {imp.status === "committed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setCategorizeImportId(imp.id)}
                          data-testid={`button-categorize-${imp.id}`}
                        >
                          <Tag className="size-3" />
                          Categorizar
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => reprocessMutation.mutate(imp.id)}
                        disabled={reprocessMutation.isPending}
                        title="Reprocessar regras"
                        data-testid={`button-reprocess-${imp.id}`}
                      >
                        <RotateCcw className="size-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded ledger preview */}
                  {isExpanded && (
                    <LedgerPreview
                      importId={imp.id}
                      categories={categories}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      {reviewImportId != null && (
        <ReviewDialog
          importId={reviewImportId}
          categories={categories}
          onClose={() => setReviewImportId(null)}
        />
      )}

      {/* Bulk categorize dialog */}
      {categorizeImportId != null && (
        <BulkCategorizeDialog
          importId={categorizeImportId}
          categories={categories}
          onClose={() => setCategorizeImportId(null)}
        />
      )}
    </div>
  );
}

// ─── Ledger Preview (inline expanded) ────────────────────────────────────────

function LedgerPreview({
  importId,
  categories,
}: {
  importId: number;
  categories: Category[];
}) {
  const { data: rows = [], isLoading } = useQuery<LedgerTransaction[]>({
    queryKey: ["/api/imports", importId, "ledger-transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/imports/${importId}/ledger-transactions`);
      return res.json();
    },
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground mt-3 pl-7">Carregando...</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-3 pl-7">
        Nenhuma transação no ledger.
      </p>
    );
  }

  const affects = rows.filter((r) => r.affectsIncomeExpense);
  const skipped = rows.filter((r) => !r.affectsIncomeExpense);
  const needsReview = rows.filter((r) => r.needsReview);

  return (
    <div className="mt-4 pl-7 space-y-3">
      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        <span>{rows.length} linhas</span>
        <span>· {affects.length} lançam na lista</span>
        {skipped.length > 0 && <span>· {skipped.length} ignoradas (transfer/tarifa)</span>}
        {needsReview.length > 0 && (
          <span className="text-amber-600 font-medium">· {needsReview.length} precisam revisão</span>
        )}
      </div>
      <div className="border rounded-md divide-y max-h-72 overflow-y-auto text-xs">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 ${row.needsReview ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {row.needsReview && (
                <AlertTriangle className="size-3 text-amber-500 shrink-0" />
              )}
              <span className="truncate text-muted-foreground w-24 shrink-0">
                {formatDate(row.postedAt)}
              </span>
              <span className="truncate">{row.descriptionNormalized}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                {KIND_LABELS[row.kind] ?? row.kind}
              </Badge>
              {!row.affectsIncomeExpense && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                  ignorada
                </Badge>
              )}
            </div>
            <span
              className={`tabular-nums shrink-0 font-medium ${row.amountNormalized >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {row.amountNormalized >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(row.amountNormalized))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Review Dialog ────────────────────────────────────────────────────────────

function ReviewDialog({
  importId,
  categories,
  onClose,
}: {
  importId: number;
  categories: Category[];
  onClose: () => void;
}) {
  const { toast } = useToast();

  const { data: rows = [], isLoading } = useQuery<LedgerTransaction[]>({
    queryKey: ["/api/imports", importId, "ledger-transactions", "all"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/imports/${importId}/ledger-transactions?includeDuplicates=true`,
      );
      return res.json();
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: { affectsIncomeExpense?: boolean; needsReview?: boolean; kind?: string };
    }) => {
      const res = await apiRequest("PATCH", `/api/ledger-transactions/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/imports", importId, "ledger-transactions"],
      });
      toast({ title: "Linha atualizada" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const needsReviewRows = rows.filter((r) => r.needsReview);
  const okRows = rows.filter((r) => !r.needsReview);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar Import #{importId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {needsReviewRows.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="size-4" />
                  {needsReviewRows.length} linha{needsReviewRows.length !== 1 ? "s" : ""} precisando revisão
                </p>
                <LedgerReviewTable
                  rows={needsReviewRows}
                  onPatch={(id, patch) => patchMutation.mutate({ id, patch })}
                  isPending={patchMutation.isPending}
                  highlight
                />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Todas as linhas ({rows.length})
              </p>
              <LedgerReviewTable
                rows={rows}
                onPatch={(id, patch) => patchMutation.mutate({ id, patch })}
                isPending={patchMutation.isPending}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LedgerReviewTable({
  rows,
  onPatch,
  isPending,
  highlight,
}: {
  rows: LedgerTransaction[];
  onPatch: (id: number, patch: Record<string, unknown>) => void;
  isPending: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="border rounded-md divide-y text-xs">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 ${
            highlight && row.needsReview ? "bg-amber-50 dark:bg-amber-950/20" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{row.descriptionNormalized}</p>
            <p className="text-muted-foreground">{formatDate(row.postedAt)}</p>
          </div>
          <span
            className={`tabular-nums font-medium shrink-0 ${row.amountNormalized >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {row.amountNormalized >= 0 ? "+" : ""}
            {formatCurrency(Math.abs(row.amountNormalized))}
          </span>
          <Select
            value={row.kind}
            onValueChange={(v) => onPatch(row.id, { kind: v })}
            disabled={isPending}
          >
            <SelectTrigger className="h-6 text-[10px] w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={row.affectsIncomeExpense ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => onPatch(row.id, { affectsIncomeExpense: !row.affectsIncomeExpense })}
            disabled={isPending}
            title={row.affectsIncomeExpense ? "Clique para ignorar (não lança na lista)" : "Clique para lançar na lista"}
          >
            {row.affectsIncomeExpense ? "Lançar" : "Ignorar"}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Bulk Categorize Dialog ───────────────────────────────────────────────────

function BulkCategorizeDialog({
  importId,
  categories,
  onClose,
}: {
  importId: number;
  categories: Category[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<number, string>>({});

  const { data: txs = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/imports", importId, "committed-transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/imports/${importId}/committed-transactions`);
      return res.json();
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(assignments)
        .filter(([, catId]) => catId !== "")
        .map(([txId, catId]) => ({
          transactionId: Number(txId),
          categoryId: catId === "none" ? null : Number(catId),
        }));
      if (payload.length === 0) throw new Error("Nenhuma categoria selecionada.");
      const res = await apiRequest("POST", `/api/imports/${importId}/bulk-categorize`, {
        assignments: payload,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/imports", importId, "committed-transactions"],
      });
      onClose();
      toast({
        title: "Categorização aplicada",
        description: `${data.updated} transaç${data.updated === 1 ? "ão atualizada" : "ões atualizadas"}.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao categorizar", description: String(e?.message || ""), variant: "destructive" }),
  });

  const uncategorized = txs.filter((t) => !t.categoryId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorizar transações — Import #{importId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma transação commitada neste import.
          </p>
        ) : (
          <div className="space-y-4">
            {uncategorized.length > 0 && (
              <p className="text-xs text-amber-600">
                {uncategorized.length} sem categoria · selecione abaixo e clique em Aplicar.
              </p>
            )}
            <div className="border rounded-md divide-y text-sm">
              {txs.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const selectedCat = assignments[tx.id];
                const filteredCats = categories.filter(
                  (c) => c.type === tx.type || c.type === "ambos",
                );
                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                    <span
                      className={`tabular-nums text-sm font-semibold shrink-0 ${tx.type === "receita" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {tx.type === "receita" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                    <Select
                      value={selectedCat !== undefined ? selectedCat : cat ? String(cat.id) : ""}
                      onValueChange={(v) =>
                        setAssignments((prev) => ({ ...prev, [tx.id]: v }))
                      }
                    >
                      <SelectTrigger className="w-40 h-7 text-xs">
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">
                          Sem categoria
                        </SelectItem>
                        {filteredCats.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <Button
              className="w-full"
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending || Object.keys(assignments).length === 0}
              data-testid="button-apply-categories"
            >
              {bulkMutation.isPending ? "Aplicando..." : "Aplicar Categorias"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
