"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "./clsx";
import { api } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/rules", label: "Rules" },
  { href: "/income-statement", label: "Income Statement" },
  { href: "/balance-sheet", label: "Balance Sheet" },
  { href: "/assets", label: "Assets & Liabilities" },
  { href: "/settings", label: "Settings" },
];

const brand = (
  <div className="px-2 text-lg font-bold tracking-tight">Ledger<span className="text-brand">Lite</span></div>
);

// On desktop this is a persistent left sidebar. On phones it collapses to a
// sticky top bar with a hamburger that opens a slide-in drawer (same nav).
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation (link tap or back/forward).
  useEffect(() => { setOpen(false); }, [pathname]);
  // Prevent the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function toggleTheme() {
    const el = document.documentElement;
    const dark = el.classList.toggle("dark");
    localStorage.theme = dark ? "dark" : "light";
  }
  async function logout() { setOpen(false); await api("/auth/logout", { method: "POST" }); router.push("/login"); }

  const links = (
    <nav className="flex-1 space-y-1">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href}
          className={clsx("block rounded-lg px-3 py-2 text-sm font-medium",
            pathname.startsWith(n.href) ? "bg-brand/10 text-brand" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800")}>
          {n.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-1 border-t border-gray-200 pt-3 dark:border-gray-800">
      <button onClick={toggleTheme} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Toggle theme</button>
      <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Sign out</button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-3 py-3 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-900/90"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        {brand}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4 md:flex dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6">{brand}</div>
        {links}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu"
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
            {links}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
