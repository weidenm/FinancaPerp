import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import type { Category } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
  ambos: "Ambos",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  receita: "default",
  despesa: "secondary",
  ambos: "outline",
};

const COLOR_OPTIONS = [
  "slate", "gray", "red", "orange", "amber", "yellow",
  "lime", "green", "emerald", "teal", "cyan", "blue",
  "indigo", "violet", "purple", "pink",
];

const emptyForm = {
  name: "",
  icon: "circle",
  color: "slate",
  type: "despesa" as Category["type"],
};

export default function Categorias() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState<"all" | Category["type"]>("all");

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: "Categoria criada" });
    },
    onError: () => toast({ title: "Erro ao criar categoria", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) => {
      const res = await apiRequest("PATCH", `/api/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditCategory(null);
      toast({ title: "Categoria atualizada" });
    },
    onError: () => toast({ title: "Erro ao atualizar categoria", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria removida" });
    },
    onError: () => toast({ title: "Erro ao remover categoria", variant: "destructive" }),
  });

  function openEdit(cat: Category) {
    setEditCategory(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, type: cat.type });
  }

  const filtered =
    filterType === "all" ? categories : categories.filter((c) => c.type === filterType);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-categorias-title">
            Categorias
          </h2>
          <p className="text-sm text-muted-foreground">
            {categories.length} categoria{categories.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as typeof filterType)}
          >
            <SelectTrigger className="w-36" data-testid="select-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>

          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setForm(emptyForm);
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="button-add-category">
                <Plus className="size-4 mr-1.5" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Categoria</DialogTitle>
              </DialogHeader>
              <CategoryForm
                form={form}
                setForm={setForm}
                isPending={createMutation.isPending}
                onSubmit={() => createMutation.mutate(form)}
                submitLabel="Criar Categoria"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filterType === "all"
                ? "Nenhuma categoria cadastrada."
                : `Nenhuma categoria do tipo "${TYPE_LABELS[filterType]}".`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((cat) => (
            <Card key={cat.id} data-testid={`card-category-${cat.id}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-8 rounded-md flex items-center justify-center shrink-0 bg-muted"
                      style={{ borderLeft: `3px solid` }}
                      data-color={cat.color}
                    >
                      <Tag className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      <Badge variant={TYPE_VARIANTS[cat.type]} className="text-[10px] h-4 px-1.5 mt-0.5">
                        {TYPE_LABELS[cat.type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(cat)}
                      data-testid={`button-edit-category-${cat.id}`}
                      aria-label="Editar categoria"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(cat.id)}
                      data-testid={`button-delete-category-${cat.id}`}
                      aria-label="Remover categoria"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editCategory}
        onOpenChange={(o) => {
          if (!o) {
            setEditCategory(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <CategoryForm
            form={form}
            setForm={setForm}
            isPending={updateMutation.isPending}
            onSubmit={() => {
              if (!editCategory) return;
              updateMutation.mutate({ id: editCategory.id, data: form });
            }}
            submitLabel="Salvar Alterações"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CategoryFormProps {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  isPending: boolean;
  onSubmit: () => void;
  submitLabel: string;
}

function CategoryForm({ form, setForm, isPending, onSubmit, submitLabel }: CategoryFormProps) {
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
          placeholder="Ex: Alimentação"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          data-testid="input-category-name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm((f) => ({ ...f, type: v as Category["type"] }))}
          >
            <SelectTrigger data-testid="select-category-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cor</Label>
          <Select
            value={form.color}
            onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}
          >
            <SelectTrigger data-testid="select-category-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
        data-testid="button-submit-category"
      >
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
