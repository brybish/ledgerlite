"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Input, Button, Select, Skeleton } from "@/components/ui";

// Professional P&L. Date range drives the server-side computation. "Print"
// uses the browser print dialog (window.print); "Download PDF" generates a
// real PDF client-side (jsPDF) and downloads it directly, mirroring "Export CSV".
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function IncomeStatementPage() {
  const thisYear = new Date().getFullYear();
  // Default to the current calendar year. The Year/Month dropdowns are quick
  // shortcuts that set From/To; the date inputs remain editable for custom ranges.
  const [start, setStart] = useState(`${thisYear}-01-01`);
  const [end, setEnd] = useState(`${thisYear}-12-31`);
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(0); // 0 = full year, 1–12 = that month
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4];

  function applyPeriod(y: number, m: number) {
    setYear(y);
    setMonth(m);
    if (m === 0) {
      setStart(`${y}-01-01`);
      setEnd(`${y}-12-31`);
    } else {
      const mm = String(m).padStart(2, "0");
      const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of m
      setStart(`${y}-${mm}-01`);
      setEnd(`${y}-${mm}-${String(lastDay).padStart(2, "0")}`);
    }
  }

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

  // Same data and date range as the CSV export, rendered as a downloadable PDF.
  // jsPDF is loaded lazily so it never weighs down the initial page bundle.
  async function exportPdf() {
    if (!d) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const left = 56, right = 556, lineH = 16, bottom = 740;
    let y = 64;

    const ensure = (need = lineH) => { if (y + need > bottom) { doc.addPage(); y = 64; } };
    const row = (label: string, amount: number, opts: { bold?: boolean; size?: number } = {}) => {
      ensure();
      doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(opts.size ?? 10).setTextColor(0);
      doc.text(label, left, y);
      doc.text(fmtUSD(amount), right, y, { align: "right" });
      y += lineH;
    };
    const section = (title: string, lines: any[], total: number) => {
      ensure(lineH * 2);
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(110);
      doc.text(title.toUpperCase(), left, y);
      y += lineH;
      if (lines.length === 0) {
        ensure();
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(150);
        doc.text("None", left, y);
        y += lineH;
      } else {
        for (const l of lines) row(l.categoryName, l.amount);
      }
      y += 2;
      doc.setDrawColor(200).line(left, y, right, y);
      y += 12;
      row(`Total ${title}`, total, { bold: true });
      y += 8;
    };

    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(0);
    doc.text("Income Statement", left, y);
    y += 18;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text(`Profit & Loss · ${start} to ${end}`, left, y);
    y += 26;

    section("Revenue", d.revenue, d.totalRevenue);
    section("Expenses", d.expenses, d.totalExpenses);

    ensure(lineH * 2);
    doc.setDrawColor(110).setLineWidth(1.2).line(left, y, right, y);
    doc.setLineWidth(1);
    y += 14;
    row("Net Income", d.netIncome, { bold: true, size: 12 });

    if (d.uncategorizedCount > 0) {
      y += 6;
      ensure();
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(180, 130, 0);
      doc.text(`${d.uncategorizedCount} uncategorized transaction(s) are excluded.`, left, y);
    }

    doc.save("income-statement.pdf");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">Income Statement</h1>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="text-xs text-gray-500">Year</label><Select value={year} onChange={(e: any) => applyPeriod(Number(e.target.value), month)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>
          <div><label className="text-xs text-gray-500">Month</label><Select value={month} onChange={(e: any) => applyPeriod(year, Number(e.target.value))}><option value={0}>Full year</option>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</Select></div>
          <div><label className="text-xs text-gray-500">From</label><Input type="date" value={start} onChange={(e: any) => setStart(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">To</label><Input type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} /></div>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={exportPdf} disabled={!d}>Download PDF</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
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
