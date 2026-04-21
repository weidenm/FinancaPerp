import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const COLORS = [
  "hsl(160, 84%, 29%)",
  "hsl(200, 80%, 45%)",
  "hsl(43, 74%, 49%)",
  "hsl(280, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(25, 80%, 50%)",
  "hsl(310, 50%, 45%)",
  "hsl(175, 60%, 35%)",
];

interface MonthlySummary {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
  savingsRate: number;
}

interface CategoryBreakdown {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  total: number;
  pct: number;
}

export default function Relatorios() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [breakdownMonth, setBreakdownMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const { data: monthly = [], isLoading: monthlyLoading } = useQuery<MonthlySummary[]>({
    queryKey: ["/api/reports/monthly-summary", year],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/monthly-summary?year=${year}`);
      return res.json();
    },
  });

  const { data: breakdown = [], isLoading: breakdownLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/reports/category-breakdown", breakdownMonth],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/category-breakdown?month=${breakdownMonth}`);
      return res.json();
    },
  });

  const { data: topCats = [] } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/reports/top-categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/top-categories?months=6`);
      return res.json();
    },
  });

  const chartData = monthly.map((row, i) => ({
    name: MONTH_NAMES[i],
    Receitas: row.receitas,
    Despesas: row.despesas,
    Saldo: row.saldo,
  }));

  const savingsData = monthly.map((row, i) => ({
    name: MONTH_NAMES[i],
    "Tx. Poupança (%)": Math.round(row.savingsRate * 10) / 10,
  }));

  const totalReceitas = monthly.reduce((s, r) => s + r.receitas, 0);
  const totalDespesas = monthly.reduce((s, r) => s + r.despesas, 0);
  const totalSaldo = totalReceitas - totalDespesas;
  const avgSavings =
    monthly.filter((r) => r.receitas > 0).length > 0
      ? monthly.filter((r) => r.receitas > 0).reduce((s, r) => s + r.savingsRate, 0) /
        monthly.filter((r) => r.receitas > 0).length
      : 0;

  const navigateBreakdownMonth = (dir: number) => {
    const [y, m] = breakdownMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setBreakdownMonth(d.toISOString().slice(0, 7));
  };

  const breakdownMonthLabel = new Date(breakdownMonth + "-15").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-relatorios-title">
            Relatórios
          </h2>
          <p className="text-sm text-muted-foreground">Análise financeira anual e por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium min-w-[3rem] text-center">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Annual KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Receitas {year}</p>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalReceitas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Despesas {year}</p>
              <TrendingDown className="size-4 text-red-500" />
            </div>
            <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(totalDespesas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Saldo {year}</p>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
            <p
              className={`text-lg font-bold tabular-nums ${totalSaldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatCurrency(totalSaldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Poupança média</p>
              <Percent className="size-4 text-muted-foreground" />
            </div>
            <p
              className={`text-lg font-bold tabular-nums ${avgSavings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {avgSavings.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Annual bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Receitas vs Despesas — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyLoading ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                  width={56}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="Receitas"
                  fill="hsl(160, 84%, 29%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="Despesas"
                  fill="hsl(0, 72%, 51%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Savings rate evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Taxa de Poupança Mensal (%) — {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={savingsData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Taxa de Poupança"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Line
                type="monotone"
                dataKey="Tx. Poupança (%)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown + Top categories grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category breakdown by month */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Despesas por Categoria</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigateBreakdownMonth(-1)}
                  data-testid="button-breakdown-prev-month"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground capitalize min-w-[110px] text-center">
                  {breakdownMonthLabel}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigateBreakdownMonth(1)}
                  data-testid="button-breakdown-next-month"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma despesa neste mês
              </p>
            ) : (
              <div className="space-y-3">
                {breakdown.map((item, idx) => (
                  <div key={item.categoryId ?? "null"} data-testid={`breakdown-row-${idx}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="text-sm truncate">{item.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.pct.toFixed(0)}%
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top categories last 6 months */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Maiores Categorias (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum dado disponível
              </p>
            ) : (
              <div className="space-y-3">
                {topCats.map((item, idx) => (
                  <div key={item.categoryId ?? "null"} data-testid={`top-cat-row-${idx}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="text-sm truncate">{item.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.pct.toFixed(0)}%
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
