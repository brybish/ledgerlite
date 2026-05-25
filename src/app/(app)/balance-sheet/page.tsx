"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Button, Skeleton } from "@/components/ui";

// Balance sheet view. Combines bank balances + manual items + retained
// earnings, and surfaces the accounting-equation check.
export default function BalanceSheetPage() {
  const q = useQuery({ queryKey: ["bs-page"], queryFn: () => api<any>("/reports/balance-sheet") });
  const d = q.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold">Balance Sheet</h1>
        <Button variant="outline" onClick={() => window.print()}>Print / PDF</Button>
      </div>
      {q.isLoading || !d ? <Skeleton className="h-96" /> : (
        <Card className="mx-auto max-w-2xl">
          <p className="text-center text-sm text-gray-500">As of {new Date(d.asOf).toLocaleDateString()}</p>

          <Group title="Assets">
            <Lines label="Current Assets" lines={d.assets.current} />
            <Lines label="Long-term Assets" lines={d.assets.longTerm} />
            <Total label="Total Assets" amount={d.totalAssets} />
          </Group>

          <Group title="Liabilities">
            <Lines label="Current Liabilities" lines={d.liabilities.current} />
            <Lines label="Long-term Liabilities" lines={d.liabilities.longTerm} />
            <Total label="Total Liabilities" amount={d.liabilities.total} />
          </Group>

          <Group title="Equity">
            <Lines lines={d.equity.lines} />
            <Total label="Total Equity" amount={d.equity.total} />
          </Group>

          <div className="mt-4 flex justify-between border-t-2 border-gray-300 pt-3 font-bold dark:border-gray-700">
            <span>Liabilities + Equity</span><span>{fmtUSD(d.totalLiabilitiesAndEquity)}</span>
          </div>
          <p className={`mt-2 text-center text-xs ${d.balances ? "text-emerald-600" : "text-red-600"}`}>
            {d.balances ? "✓ Assets = Liabilities + Equity" : "Equation does not balance — see Unreconciled Equity line"}
          </p>
        </Card>
      )}
    </div>
  );
}

function Group({ title, children }: any) {
  return <div className="mt-5"><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>{children}</div>;
}
function Lines({ label, lines }: { label?: string; lines: any[] }) {
  if (!lines?.length) return null;
  return (
    <div className="mt-1">
      {label && <p className="mt-2 text-xs font-medium text-gray-400">{label}</p>}
      {lines.map((l: any, i: number) => (
        <div key={i} className="flex justify-between py-1 text-sm"><span>{l.label}</span><span>{fmtUSD(l.amount)}</span></div>
      ))}
    </div>
  );
}
function Total({ label, amount }: { label: string; amount: number }) {
  return <div className="flex justify-between border-t border-gray-200 py-1.5 text-sm font-semibold dark:border-gray-800"><span>{label}</span><span>{fmtUSD(amount)}</span></div>;
}
