import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Pencil, CreditCard, Banknote, PiggyBank } from "lucide-react";
import type { Account } from "@shared/schema";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
};

const SIGN_CONVENTION_LABELS: Record<string, string> = {
  natural: "Natural (entradas +, saídas −)",
  inverted: "Invertido (entradas −, saídas +)",
};

const ACCOUNT_ICONS: Record<string, React.ElementType> = {
  checking: Banknote,
  savings: PiggyBank,
  credit_card: CreditCard,
};

const emptyForm = {
  name: "",
  type: "checking" as Account["type"],
  connectorId: "generic_csv",
  signConvention: "natural" as Account["signConvention"],
  currency: "BRL",
  treatPixAsExpense: false,
};

export default function Contas() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: "Conta criada" });
    },
    onError: () => toast({ title: "Erro ao criar conta", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setEditAccount(null);
      toast({ title: "Conta atualizada" });
    },
    onError: () => toast({ title: "Erro ao atualizar conta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Conta removida" });
    },
    onError: () => toast({ title: "Erro ao remover conta", variant: "destructive" }),
  });

  function openEdit(account: Account) {
    setEditAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      connectorId: account.connectorId,
      signConvention: account.signConvention,
      currency: account.currency,
      treatPixAsExpense: account.treatPixAsExpense,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-contas-title">
            Contas
          </h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} conta{accounts.length !== 1 ? "s" : ""} cadastrada{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setForm(emptyForm);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="size-4 mr-1.5" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta</DialogTitle>
            </DialogHeader>
            <AccountForm
              form={form}
              setForm={setForm}
              isPending={createMutation.isPending}
              onSubmit={() => createMutation.mutate(form)}
              submitLabel="Criar Conta"
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Crie uma para começar a importar extratos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type] ?? CreditCard;
            return (
              <Card key={account.id} data-testid={`card-account-${account.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sinal: {SIGN_CONVENTION_LABELS[account.signConvention]}
                          {account.treatPixAsExpense && (
                            <span className="ml-1.5 text-blue-600 dark:text-blue-400">· PIX como despesa</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(account)}
                        data-testid={`button-edit-account-${account.id}`}
                        aria-label="Editar conta"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(account.id)}
                        data-testid={`button-delete-account-${account.id}`}
                        aria-label="Remover conta"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editAccount}
        onOpenChange={(o) => {
          if (!o) {
            setEditAccount(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
          </DialogHeader>
          <AccountForm
            form={form}
            setForm={setForm}
            isPending={updateMutation.isPending}
            onSubmit={() => {
              if (!editAccount) return;
              updateMutation.mutate({ id: editAccount.id, data: form });
            }}
            submitLabel="Salvar Alterações"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AccountFormProps {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  isPending: boolean;
  onSubmit: () => void;
  submitLabel: string;
}

function AccountForm({ form, setForm, isPending, onSubmit, submitLabel }: AccountFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input
          placeholder="Ex: Itaú Corrente"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          data-testid="input-account-name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm((f) => ({ ...f, type: v as Account["type"] }))}
          >
            <SelectTrigger data-testid="select-account-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Conta corrente</SelectItem>
              <SelectItem value="savings">Poupança</SelectItem>
              <SelectItem value="credit_card">Cartão de crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Moeda</Label>
          <Input
            placeholder="BRL"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            data-testid="input-account-currency"
          />
        </div>
      </div>
      <div>
        <Label>Convenção de sinal</Label>
        <Select
          value={form.signConvention}
          onValueChange={(v) => setForm((f) => ({ ...f, signConvention: v as Account["signConvention"] }))}
        >
          <SelectTrigger data-testid="select-account-sign-convention">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="natural">Natural (entradas +, saídas −)</SelectItem>
            <SelectItem value="inverted">Invertido (entradas −, saídas +)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Use "Invertido" se o extrato do banco mostra despesas com valor positivo.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">PIX/TED/DOC como despesa</p>
          <p className="text-xs text-muted-foreground">
            Quando ativo, transferências via PIX/TED/DOC são lançadas como receita ou despesa
            (rules v2).
          </p>
        </div>
        <Switch
          checked={form.treatPixAsExpense}
          onCheckedChange={(v) => setForm((f) => ({ ...f, treatPixAsExpense: v }))}
          data-testid="switch-treat-pix-as-expense"
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
        data-testid="button-submit-account"
      >
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
