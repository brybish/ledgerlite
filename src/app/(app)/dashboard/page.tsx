"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

// Dashboard aggregates this-month + YTD income statements, a 6-month trend, and
// the balance sheet. Everything reacts to categorized transactions, so the
// numbers stay consistent with the reports pages.

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleString("en-US", { month: "short" }) };
}

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: React.ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={clsx("mt-1 text-2xl font-semibold", accent)}>{value}</p>
      {sub && <p className="mt-1 text-xs">{sub}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const thisMonth = monthRange(0);
  const thisYear = new Date().getFullYear();
  const yearStart = new Date(thisYear, 0, 1).toISOString();
  const yearEnd = new Date().toISOString();

  const pnl = useQuery({ queryKey: ["pnl", thisMonth.start], queryFn: () => api<any>(`/reports/income-statement?start=${thisMonth.start}&end=${thisMonth.end}`) });
  const ytd = useQuery({ queryKey: ["pnl", "ytd", thisYear], queryFn: () => api<any>(`/reports/income-statement?start=${yearStart}&end=${yearEnd}`) });
  const bs = useQuery({ queryKey: ["bs"], queryFn: () => api<any>("/reports/balance-sheet") });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => api<any>("/transactions?pageSize=8&sort=date&dir=desc") });
  const uncategorized = useQuery({ queryKey: ["uncat"], queryFn: () => api<any>("/transactions?filter=uncategorized&pageSize=1") });

  const trend = useQuery({
    queryKey: ["trend"],
    queryFn: async () => {
      const months = [5, 4, 3, 2, 1, 0].map(monthRange);
      return Promise.all(
        months.map(async (m) => {
          const s = await api<any>(`/reports/income-statement?start=${m.start}&end=${m.end}`);
          return { month: m.label, income: s.totalRevenue / 100, expenses: s.totalExpenses / 100, net: s.netIncome / 100 };
        })
      );
    },
  });

  // Net worth = assets − liabilities (= equity); cash from the balance sheet.
  const totalAssets = bs.data?.totalAssets ?? 0;
  const totalLiabilities = bs.data?.liabilities?.total ?? 0;
  const netWorth = totalAssets - totalLiabilities;
  const cash = bs.data?.assets?.current?.find((l: any) => l.label.includes("Cash"))?.amount ?? 0;

  // Month-over-month change in net income (from the trend series; last entry is this month).
  const t = trend.data;
  const moM = t && t.length >= 2 ? t[t.length - 1].net - t[t.length - 2].net : null;

  // Top spending this month (donut), collapsing the long tail into "Other".
  const exp = (pnl.data?.expenses ?? []) as { categoryName: string; amount: number }[];
  const topExp = exp.slice(0, 7).map((e) => ({ name: e.categoryName, value: e.amount / 100 }));
  const otherTotal = exp.slice(7).reduce((s, e) => s + e.amount, 0) / 100;
  if (otherTotal > 0) topExp.push({ name: "Other", value: otherTotal });

  const ytdIncome = ytd.data?.totalRevenue ?? 0;
  const ytdNet = ytd.data?.netIncome ?? 0;
  const savingsRate = ytdIncome > 0 ? Math.round((ytdNet / ytdIncome) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {uncategorized.data?.total > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          You have {uncategorized.data.total} uncategorized transaction(s). Categorize them for accurate statements.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pnl.isLoading || bs.isLoading ? (
          <><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></>
        ) : (
          <>
            <StatCard label="Cash on hand" value={fmtUSD(cash)} />
            <StatCard label="Net worth" value={fmtUSD(netWorth)} accent={netWorth >= 0 ? "" : "text-red-600"}
              sub={<span className="text-gray-500">{fmtUSD(totalAssets)} assets − {fmtUSD(totalLiabilities)} liabilities</span>} />
            <StatCard label="Income (this mo)" value={fmtUSD(pnl.data?.totalRevenue ?? 0)} accent="text-emerald-600" />
            <StatCard label="Net profit (this mo)" value={fmtUSD(pnl.data?.netIncome ?? 0)}
              accent={(pnl.data?.netIncome ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}
              sub={moM == null ? undefined : (
                <span className={moM >= 0 ? "text-emerald-600" : "text-red-600"}>{moM >= 0 ? "▲" : "▼"} {fmtUSD(Math.abs(moM * 100))} vs last mo</span>
              )} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Income vs Expenses (6 mo)</h2>
          <div className="h-64">
            {trend.data ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line dataKey="net" name="Net" type="monotone" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Legend fontSize={12} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full" />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Top spending (this mo)</h2>
          <div className="h-64">
            {pnl.isLoading ? <Skeleton className="h-full" /> : topExp.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-sm text-gray-400">No expenses recorded this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topExp} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {topExp.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend fontSize={11} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">This year ({thisYear})</h2>
          {ytd.isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Income</span><span className="font-medium text-emerald-600">{fmtUSD(ytdIncome)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expenses</span><span className="font-medium text-red-600">{fmtUSD(ytd.data?.totalExpenses ?? 0)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 dark:border-gray-800"><span className="font-medium">Net</span><span className={clsx("font-semibold", ytdNet >= 0 ? "text-emerald-600" : "text-red-600")}>{fmtUSD(ytdNet)}</span></div>
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/40">
                <div className="flex justify-between"><span className="text-gray-500">Savings rate</span><span className="font-semibold">{savingsRate}%</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} />
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Recent transactions</h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recent.data?.items?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">{t.merchantName ?? t.description}</p>
                  <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()} · {t.category?.name ?? (t.isSplit ? "Split" : "Uncategorized")}</p>
                </div>
                <span className={t.amount >= 0 ? "text-emerald-600" : "text-gray-700 dark:text-gray-300"}>{fmtUSD(t.amount)}</span>
              </div>
            )) ?? <Skeleton className="h-24" />}
            {recent.data?.items?.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No transactions yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
