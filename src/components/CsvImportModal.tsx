"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { parseCsv, parseAmount, toCalendarIso } from "@/lib/csv";
import { Button, Select, Label } from "@/components/ui";

// Import transactions from a bank-exported CSV. Everything (parse + column
// mapping + sign normalization) happens client-side; we send already-normalized
// signed-cents rows to /transactions/import. Assumes one signed Amount column.
const guess = (headers: string[], re: RegExp, fallback: number) => {
  const i = headers.findIndex((h) => re.test(h));
  return i >= 0 ? i : fallback;
};

export function CsvImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amtCol, setAmtCol] = useState(2);
  const [debitSign, setDebitSign] = useState<"negative" | "positive">("negative");
  const [parseError, setParseError] = useState("");

  async function onFile(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParseError("");
    try {
      const parsed = parseCsv(await f.text());
      if (parsed.length === 0) { setParseError("That file has no rows."); return; }
      setFileName(f.name);
      setRows(parsed);
      const headers = parsed[0];
      setDateCol(guess(headers, /date|posted/i, 0));
      setDescCol(guess(headers, /desc|name|memo|payee|merchant|detail/i, 1));
      setAmtCol(guess(headers, /amount|amt|debit/i, 2));
    } catch {
      setParseError("Couldn't read that file. Make sure it's a .csv export.");
    }
  }

  const colCount = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
  const headerLabels = useMemo(
    () => Array.from({ length: colCount }, (_, i) => (hasHeader && rows[0]?.[i]?.trim()) || `Column ${i + 1}`),
    [rows, hasHeader, colCount]
  );
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  // Normalize a raw row to { date(ISO), description, amount(signed cents) } or null if unusable.
  const mapRow = (r: string[]) => {
    const date = toCalendarIso(r[dateCol] ?? "");
    const description = (r[descCol] ?? "").trim();
    const raw = parseAmount(r[amtCol] ?? "");
    if (!date || !description || Number.isNaN(raw)) return null;
    const signedDollars = debitSign === "positive" ? -raw : raw;
    return { date, description, amount: Math.round(signedDollars * 100) };
  };

  const mapped = useMemo(() => dataRows.map(mapRow), [dataRows, dateCol, descCol, amtCol, debitSign]);
  const valid = mapped.filter((m): m is NonNullable<typeof m> => m !== null);
  const skipped = mapped.length - valid.length;

  const run = useMutation({
    mutationFn: () => api<{ imported: number; skipped: number; rulesApplied: number }>("/transactions/import", {
      method: "POST",
      body: JSON.stringify({ source: fileName.slice(0, 120), rows: valid }),
    }),
    onSuccess: () => ["txns", "pnl", "uncat", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });

  const colSelect = (value: number, onChange: (n: number) => void) => (
    <Select value={value} onChange={(e: any) => onChange(Number(e.target.value))}>
      {headerLabels.map((h, i) => <option key={i} value={i}>{h}</option>)}
    </Select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import transactions from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {run.data ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/30">
              Imported <span className="font-semibold">{run.data.imported}</span> transaction(s).
              {run.data.skipped > 0 && <> Skipped <span className="font-medium">{run.data.skipped}</span> (duplicates).</>}
              {run.data.rulesApplied > 0 && <> Auto-categorized <span className="font-medium">{run.data.rulesApplied}</span> via rules.</>}
            </div>
            <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>CSV file</Label>
              <input type="file" accept=".csv,text/csv" onChange={onFile}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
              {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
            </div>

            {rows.length > 0 && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  First row is a header
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Date column</Label>{colSelect(dateCol, setDateCol)}</div>
                  <div><Label>Description column</Label>{colSelect(descCol, setDescCol)}</div>
                  <div><Label>Amount column</Label>{colSelect(amtCol, setAmtCol)}</div>
                </div>

                <div>
                  <Label>In this file, money leaving the account (debits) is shown as</Label>
                  <Select value={debitSign} onChange={(e: any) => setDebitSign(e.target.value)}>
                    <option value="negative">Negative numbers (e.g. -42.00) — most common</option>
                    <option value="positive">Positive numbers (e.g. 42.00)</option>
                  </Select>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Preview (first 5)</p>
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900/50">
                        <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {dataRows.slice(0, 5).map((r, i) => {
                          const m = mapRow(r);
                          return (
                            <tr key={i} className={m ? "" : "bg-red-50 dark:bg-red-950/20"}>
                              <td className="px-3 py-2">{m ? new Date(m.date).toLocaleDateString() : <span className="text-red-600">bad date</span>}</td>
                              <td className="px-3 py-2">{(r[descCol] ?? "").trim() || <span className="text-red-600">—</span>}</td>
                              <td className={`px-3 py-2 text-right ${m && m.amount >= 0 ? "text-emerald-600" : ""}`}>{m ? fmtUSD(m.amount) : <span className="text-red-600">bad amount</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{valid.length}</span> row(s) ready
                    {skipped > 0 && <> · {skipped} will be skipped (bad date/amount/description)</>} · duplicates are detected on import.
                  </p>
                </div>

                {run.error && <p className="text-sm text-red-600">{(run.error as any).message}</p>}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose} disabled={run.isPending}>Cancel</Button>
                  <Button onClick={() => run.mutate()} disabled={valid.length === 0 || run.isPending}>
                    {run.isPending ? "Importing…" : `Import ${valid.length}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
