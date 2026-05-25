"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Stat, Skeleton } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Dashboard aggregates this month's income statement + a 6-month trend derived
// from per-period income-statement calls. Everything reacts to categorized
// transactions, so the numbers stay consistent with the reports pages.

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleString("en-US", { month: "short" }) };
}

export default function DashboardPage() {
  const thisMonth = monthRange(0);

  const pnl = useQuery({
    queryKey: ["pnl", thisMonth.start],
    queryFn: () => api<any>(`/reports/income-statement?start=${thisMonth.start}&end=${thisMonth.end}`),
  });
  const bs = useQuery({ queryKey: ["bs"], queryFn: () => api<any>("/reports/balance-sheet") });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => api<any>("/transactions?pageSize=8&sort=date&dir=desc") });
  const uncategorized = useQuery({ queryKey: ["uncat"], queryFn: () => api<any>("/transactions?filter=uncategorized&pageSize=1") });

  const trend = useQuery({
    queryKey: ["trend"],
    queryFn: async () => {
      const months = [5, 4, 3, 2, 1, 0].map(monthRange);
      const data = await Promise.all(
        months.map(async (m) => {
          const s = await api<any>(`/reports/income-statement?start=${m.start}&end=${m.end}`);
          return { month: m.label, income: s.totalRevenue / 100, expenses: s.totalExpenses / 100 };
        })
      );
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {uncategorized.data?.total > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          You have {uncategorized.data.total} uncategorized transaction(s). Categorize them for accurate statements.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pnl.isLoading ? (
          <><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></>
        ) : (
          <>
            <Stat label="Cash on hand" value={fmtUSD(bs.data?.assets.current.find((l: any) => l.label.includes("Cash"))?.amount ?? 0)} />
            <Stat label="Income (mo)" value={fmtUSD(pnl.data?.totalRevenue ?? 0)} accent="text-emerald-600" />
            <Stat label="Expenses (mo)" value={fmtUSD(pnl.data?.totalExpenses ?? 0)} accent="text-red-600" />
            <Stat label="Net profit (mo)" value={fmtUSD(pnl.data?.netIncome ?? 0)} accent={(pnl.data?.netIncome ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"} />
          </>
        )}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Income vs Expenses (6 mo)</h2>
        <div className="h-64">
          {trend.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend.data}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full" />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Recent transactions</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {recent.data?.items?.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium">{t.merchantName ?? t.description}</p>
                <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()} · {t.category?.name ?? "Uncategorized"}</p>
              </div>
              <span className={t.amount >= 0 ? "text-emerald-600" : "text-gray-700 dark:text-gray-300"}>{fmtUSD(t.amount)}</span>
            </div>
          )) ?? <Skeleton className="h-24" />}
        </div>
      </Card>
    </div>
  );
}
