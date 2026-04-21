import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, getCurrentMonth, getMonthLabel, getLastDayOfMonth } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { Transaction, Goal } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthlySummary {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

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

const TREND_MONTHS_OPTIONS = [3, 6, 12];

/** Format YYYY-MM as "Jan/25" */
function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + "/" + String(y).slice(2);
}

export default function Dashboard() {
  const currentMonth = getCurrentMonth();
  const [trendMonths, setTrendMonths] = useState(6);

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", currentMonth],
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endDate = getLastDayOfMonth(currentMonth);
      const res = await apiRequest("GET", `/api/transactions?startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    },
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: categories = [] } = useQuery<{ id: number; name: string; icon: string; color: string }[]>({
    queryKey: ["/api/categories"],
  });

  const { data: summary = [] } = useQuery<MonthlySummary[]>({
    queryKey: ["/api/transactions/summary", trendMonths],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/transactions/summary?months=${trendMonths}`);
      return res.json();
    },
  });

  const receitas = transactions
    .filter((t) => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);
  const despesas = transactions
    .filter((t) => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);
  const saldo = receitas - despesas;
  const taxaPoupanca = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

  // Expense by category
  const expenseByCategory = transactions
    .filter((t) => t.type === "despesa")
    .reduce((acc, t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      const name = cat?.name || "Outros";
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  // Daily spending (last 7 days)
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const dailyData = last7.map((date) => {
    const dayTxs = transactions.filter((t) => t.date === date && t.type === "despesa");
    const total = dayTxs.reduce((sum, t) => sum + t.amount, 0);
    const label = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
    });
    return { date: label, total };
  });

  const trendData = summary.map((s) => ({
    month: shortMonth(s.month),
    Receitas: s.receitas,
    Despesas: s.despesas,
    Saldo: s.saldo,
  }));

  const recentTransactions = transactions.slice(0, 5);

  const tooltipStyle = {
    borderRadius: "8px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
  };

  if (txLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-dashboard-title">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground capitalize">
          {getMonthLabel(currentMonth)}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
            <p
              className={`text-xl font-bold tabular-nums mt-1 ${saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              data-testid="text-saldo"
            >
              {formatCurrency(saldo)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Receitas</p>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p
              className="text-xl font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400"
              data-testid="text-receitas"
            >
              {formatCurrency(receitas)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Despesas</p>
              <TrendingDown className="size-4 text-red-500" />
            </div>
            <p
              className="text-xl font-bold tabular-nums mt-1 text-red-600 dark:text-red-400"
              data-testid="text-despesas"
            >
              {formatCurrency(despesas)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Poupança</p>
              <PiggyBank className="size-4 text-muted-foreground" />
            </div>
            <p
              className={`text-xl font-bold tabular-nums mt-1 ${taxaPoupanca >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              data-testid="text-poupanca"
            >
              {taxaPoupanca.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart — full width */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold">Tendência Mensal</CardTitle>
            <Select
              value={String(trendMonths)}
              onValueChange={(v) => setTrendMonths(Number(v))}
            >
              <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-trend-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREND_MONTHS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Sem dados suficientes
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="Receitas"
                  stroke="hsl(160, 84%, 29%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Despesas"
                  stroke="hsl(0, 72%, 51%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="hsl(200, 80%, 45%)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Nenhuma despesa registrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {pieData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={COLORS[idx % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", lineHeight: "20px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Gastos Diários (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: recent transactions + goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma transação registrada
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-2"
                      data-testid={`row-transaction-${tx.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`size-8 rounded-md flex items-center justify-center shrink-0 ${tx.type === "receita" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}
                        >
                          {tx.type === "receita" ? (
                            <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="size-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cat?.name || "Outros"} · {formatDate(tx.date)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums shrink-0 ${tx.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {tx.type === "receita" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Metas Financeiras</CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma meta definida
              </p>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 4).map((goal) => {
                  const pct =
                    goal.targetAmount > 0
                      ? Math.min(
                          (goal.currentAmount / goal.targetAmount) * 100,
                          100
                        )
                      : 0;
                  return (
                    <div key={goal.id} data-testid={`card-goal-${goal.id}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium">{goal.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(goal.currentAmount)} /{" "}
                          {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
