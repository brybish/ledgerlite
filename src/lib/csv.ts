// Minimal, dependency-free CSV parser. Handles the cases real bank exports throw
// at us: quoted fields containing commas/newlines and escaped quotes (""). Walks
// the text character-by-character rather than splitting on lines so quoted
// newlines don't break rows.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Strip a UTF-8 BOM if present (common in Windows/Excel exports).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // Drop fully-blank rows (trailing newline, blank separators).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Normalize a date cell to an ISO string anchored at NOON UTC for that calendar
// day. Anchoring at noon (not midnight) means the calendar date survives
// toLocaleDateString() in any real timezone, avoiding off-by-one display. Handles
// ISO (YYYY-MM-DD) explicitly and falls back to Date parsing (e.g. MM/DD/YYYY).
export function toCalendarIso(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    y = +iso[1]; m = +iso[2]; d = +iso[3];
  } else {
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return null;
    y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
  }
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

// Parse a money string like "$1,234.56", "-12.30" or "(45.00)" (parens = negative)
// into a number. Returns NaN if it isn't numeric.
export function parseAmount(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  const negative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()$,\s]/g, "");
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}
