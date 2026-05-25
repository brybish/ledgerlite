"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Button, Skeleton } from "@/components/ui";

// Balance sheet view. Combines bank balances + manual items + retained
// earnings, and surfaces the accounting-equation check.
export default function BalanceSheetPage() {
  const q = useQuery({ queryKey: ["bs-page"], queryFn: () => api<any>("/reports/balance-sheet") });
  const d = q.data;

  // Downloadable PDF of the balance sheet — mirrors the Income Statement export.
  // jsPDF is lazy-loaded so it stays out of the initial page bundle.
  async function exportPdf() {
    if (!d) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const left = 56, right = 556, lineH = 16, bottom = 740;
    let y = 64;

    const ensure = (need = lineH) => { if (y + need > bottom) { doc.addPage(); y = 64; } };
    const row = (label: string, amount: number | null, opts: { bold?: boolean; size?: number; indent?: number } = {}) => {
      ensure();
      doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(opts.size ?? 10).setTextColor(0);
      doc.text(label, left + (opts.indent ?? 0), y);
      if (amount != null) doc.text(fmtUSD(amount), right, y, { align: "right" });
      y += lineH;
    };
    const heading = (t: string) => {
      ensure(lineH * 2);
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(110);
      doc.text(t.toUpperCase(), left, y);
      y += lineH;
    };
    const lines = (label: string | null, arr: any[]) => {
      if (!arr?.length) return;
      if (label) {
        ensure();
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(150);
        doc.text(label, left, y);
        y += 14;
      }
      for (const l of arr) row(l.label, l.amount, { indent: 12 });
    };
    const total = (label: string, amount: number) => {
      y += 2;
      doc.setDrawColor(200).line(left, y, right, y);
      y += 12;
      row(label, amount, { bold: true });
      y += 8;
    };

    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(0);
    doc.text("Balance Sheet", left, y);
    y += 18;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text(`As of ${new Date(d.asOf).toLocaleDateString()}`, left, y);
    y += 26;

    heading("Assets");
    lines("Current Assets", d.assets.current);
    lines("Long-term Assets", d.assets.longTerm);
    total("Total Assets", d.totalAssets);

    heading("Liabilities");
    lines("Current Liabilities", d.liabilities.current);
    lines("Long-term Liabilities", d.liabilities.longTerm);
    total("Total Liabilities", d.liabilities.total);

    heading("Equity");
    lines(null, d.equity.lines);
    total("Total Equity", d.equity.total);

    ensure(lineH * 2);
    doc.setDrawColor(110).setLineWidth(1.2).line(left, y, right, y);
    doc.setLineWidth(1);
    y += 14;
    row("Liabilities + Equity", d.totalLiabilitiesAndEquity, { bold: true, size: 12 });

    y += 8;
    ensure();
    doc.setFont("helvetica", "normal").setFontSize(9);
    if (d.balances) doc.setTextColor(5, 150, 80);
    else doc.setTextColor(200, 40, 40);
    doc.text(
      d.balances ? "Assets = Liabilities + Equity (balanced)" : "Equation does not balance — see Unreconciled Equity line",
      left,
      y
    );

    doc.save("balance-sheet.pdf");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold">Balance Sheet</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={!d}>Download PDF</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
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
