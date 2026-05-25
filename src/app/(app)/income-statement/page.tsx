"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Input, Button, Skeleton } from "@/components/ui";

// Professional P&L. Date range drives the server-side computation; "Print"
// uses the browser print dialog (window.print) for a printable/PDF layout.
export default function IncomeStatementPage() {
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2025-12-31");
  const q = useQuery({
    queryKey: ["is", start, end],
    queryFn: () => api<any>(`/reports/income-statement?start=${new Date(start).toISOString()}&end=${new Date(end + "T23:59:59").toISOString()}`),
  });
  const d = q.data;

  function exportCsv() {
    if (!d) return;
    const rows = [["Section", "Category", "Amount"]]
      .concat(d.revenue.map((l: any) => ["Revenue", l.categoryName, (l.amount / 100).toFixed(2)]))
      .concat(d.expenses.map((l: any) => ["Expense", l.categoryName, (l.amount / 100).toFixed(2)]))
      .concat([["Total", "Net Income", (d.netIncome / 100).toFixed(2)]]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "income-statement.csv";
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">Income Statement</h1>
        <div className="flex items-end gap-2">
          <div><label className="text-xs text-gray-500">From</label><Input type="date" value={start} onChange={(e: any) => setStart(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">To</label><Input type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} /></div>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>

      {q.isLoading || !d ? <Skeleton className="h-80" /> : (
        <Card className="mx-auto max-w-2xl">
          <p className="text-center text-sm text-gray-500">Profit & Loss · {start} to {end}</p>
          <Section title="Revenue" lines={d.revenue} total={d.totalRevenue} />
          <Section title="Expenses" lines={d.expenses} total={d.totalExpenses} />
          <div className="mt-4 flex justify-between border-t-2 border-gray-300 pt-3 text-base font-bold dark:border-gray-700">
            <span>Net Income</span>
            <span className={d.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtUSD(d.netIncome)}</span>
          </div>
          {d.uncategorizedCount > 0 && <p className="mt-3 text-xs text-amber-600">{d.uncategorizedCount} uncategorized transaction(s) are excluded.</p>}
        </Card>
      )}
    </div>
  );
}

function Section({ title, lines, total }: { title: string; lines: any[]; total: number }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
        {lines.length === 0 && <p className="py-2 text-sm text-gray-400">None</p>}
        {lines.map((l) => (
          <div key={l.categoryName} className="flex justify-between py-1.5 text-sm"><span>{l.categoryName}</span><span>{fmtUSD(l.amount)}</span></div>
        ))}
      </div>
      <div className="flex justify-between border-t border-gray-200 py-1.5 text-sm font-semibold dark:border-gray-800"><span>Total {title}</span><span>{fmtUSD(total)}</span></div>
    </div>
  );
}
