import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, ListChecks, RefreshCw, Upload } from "lucide-react";
import type { Import, LedgerTransaction } from "@shared/schema";

type ImportListRow = Import & { accountName: string };

const KIND_LABEL: Record<LedgerTransaction["kind"], string> = {
  purchase: "Compra",
  payment: "Pagamento",
  refund: "Estorno",
  transfer: "Transferência",
  fee: "Tarifa",
  interest: "Juros",
  other: "Outro",
};

export function ImportacaoLedgerDetail() {
  const [, params] = useRoute<{ importId: string }>("/importacoes/:importId");
  const importId = params?.importId ? parseInt(params.importId, 10) : NaN;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batch, isLoading: loadingBatch } = useQuery({
    queryKey: ["/api/imports", importId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/imports/${importId}`);
      if (!res.ok) throw new Error("Importação não encontrada");
      return res.json() as Promise<Import>;
    },
    enabled: Number.isFinite(importId) && importId > 0,
  });

  const { data: ledger = [], isLoading: loadingLedger } = useQuery<LedgerTransaction[]>({
    queryKey: ["/api/imports", importId, "ledger"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/imports/${importId}/ledger-transactions?includeDuplicates=true`,
      );
      return res.json();
    },
    enabled: Number.isFinite(importId) && importId > 0,
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/ledger-transactions/${id}`, body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/imports", importId, "ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar linha", description: e.message, variant: "destructive" });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/imports/${importId}/reprocess`, {});
      if (!res.ok) throw new Error("Falha ao reprocessar");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/imports", importId, "ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/imports", importId] });
      toast({ title: "Ledger recalculado", description: "Regras aplicadas de novo ao bruto." });
    },
    onError: () => toast({ title: "Erro ao reprocessar", variant: "destructive" }),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/imports/${importId}/commit`);
      if (!res.ok) throw new Error("Falha ao gravar na lista");
      return res.json() as Promise<{ created?: number; alreadyCommitted?: boolean }>;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/imports", importId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
      toast({
        title: data.alreadyCommitted ? "Já estava gravado" : "Lançamentos gravados",
        description: data.alreadyCommitted
          ? "Este lote já tinha sido confirmado."
          : `${data.created ?? 0} nova(s) transação(ões) na lista (conforme mês de cada data).`,
      });
    },
    onError: () => toast({ title: "Erro ao gravar", variant: "destructive" }),
  });

  if (!Number.isFinite(importId) || importId <= 0) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">ID de importação inválido.</p>
        <Button variant="ghost" asChild className="px-0 h-auto text-primary">
          <Link href="/importacoes">Voltar à lista</Link>
        </Button>
      </div>
    );
  }

  const sorted = [...ledger].sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  const plRows = sorted.filter((r) => r.duplicateOfId == null);
  const affectsCount = plRows.filter((r) => r.affectsIncomeExpense).length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/importacoes">
            <ArrowLeft className="size-4 mr-1" />
            Importações
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-import-detail-title">
            Revisão do ledger · Lote #{importId}
          </h2>
          {loadingBatch ? (
            <p className="text-sm text-muted-foreground mt-1">Carregando…</p>
          ) : batch ? (
            <p className="text-sm text-muted-foreground mt-1">
              Conta #{batch.accountId} · {batch.connectorId} ·{" "}
              {batch.sourceKind === "statement" ? "Extrato" : "Fatura"} ·{" "}
              <Badge variant="outline" className="ml-1 align-middle">
                {batch.status}
              </Badge>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={reprocessMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  "Recalcular o ledger a partir dos dados brutos? Perde edições feitas só no ledger (tipo e fluxo), mas corrige após mudanças nas regras.",
                )
              ) {
                reprocessMutation.mutate();
              }
            }}
          >
            <RefreshCw className="size-4 mr-1.5" />
            Reprocessar
          </Button>
          <Button
            size="sm"
            disabled={commitMutation.isPending || batch?.status === "committed"}
            onClick={() => commitMutation.mutate()}
          >
            <Upload className="size-4 mr-1.5" />
            Gravar na lista (commit)
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTitle>Receitas e despesas na lista</AlertTitle>
        <AlertDescription>
          Só entram em Transações as linhas com <strong>fluxo receita/despesa</strong> ligado e valor
          diferente de zero. Ajuste o tipo ou o interruptor abaixo se um lançamento tiver sido
          classificado como transferência/tarifa por engano — por exemplo, PIX para estabelecimento
          deve ficar no fluxo.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Linhas (sem dup)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{plRows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No fluxo R/D</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{affectsCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revisão pendente</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {plRows.filter((r) => r.needsReview).length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linhas normalizadas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loadingLedger ? (
            <p className="text-sm text-muted-foreground">Carregando ledger…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma linha neste lote.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="whitespace-nowrap">Valor bruto</TableHead>
                  <TableHead className="whitespace-nowrap">Valor (norm.)</TableHead>
                  <TableHead className="whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="whitespace-nowrap">R/D</TableHead>
                  <TableHead className="whitespace-nowrap">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const dup = row.duplicateOfId != null;
                  return (
                    <TableRow
                      key={row.id}
                      className={dup ? "opacity-60" : undefined}
                      data-testid={`ledger-row-${row.id}`}
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatDate(row.postedAt)}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate" title={row.descriptionNormalized}>
                        {row.descriptionNormalized}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{row.amountRaw}</TableCell>
                      <TableCell
                        className={`whitespace-nowrap font-medium ${
                          row.amountNormalized >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {row.amountNormalized >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(row.amountNormalized))}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.kind}
                          disabled={dup || patchMutation.isPending}
                          onValueChange={(kind) =>
                            patchMutation.mutate({
                              id: row.id,
                              body: { kind },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px]" data-testid={`select-kind-${row.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(KIND_LABEL) as LedgerTransaction["kind"][]).map((k) => (
                              <SelectItem key={k} value={k}>
                                {KIND_LABEL[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.affectsIncomeExpense}
                          disabled={dup || patchMutation.isPending}
                          onCheckedChange={(checked) =>
                            patchMutation.mutate({
                              id: row.id,
                              body: { affectsIncomeExpense: checked },
                            })
                          }
                          data-testid={`switch-pl-${row.id}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {row.needsReview ? (
                            <Badge variant="secondary">Revisar</Badge>
                          ) : null}
                          {dup ? <Badge variant="outline">Dup</Badge> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImportacoesLista() {
  const { data = [], isLoading } = useQuery<ImportListRow[]>({
    queryKey: ["/api/imports"],
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ListChecks className="size-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold" data-testid="text-importacoes-title">
            Importações
          </h2>
          <p className="text-sm text-muted-foreground">
            Revise o ledger antes de gravar na lista de transações — especialmente após OFX ou CSV com
            muitos PIX.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lotes recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.id}</TableCell>
                    <TableCell className="text-sm">{formatDate(row.createdAt.slice(0, 10))}</TableCell>
                    <TableCell>{row.accountName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/importacoes/${row.id}`}>Revisar ledger</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
