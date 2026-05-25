"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function toggleTheme() {
    const el = document.documentElement;
    const dark = el.classList.toggle("dark");
    localStorage.theme = dark ? "dark" : "light";
  }
  async function logout() { await api("/auth/logout", { method: "POST" }); router.push("/login"); }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 px-2 text-lg font-bold tracking-tight">Ledger<span className="text-brand">Lite</span></div>
      <nav className="flex-1 space-y-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={clsx("block rounded-lg px-3 py-2 text-sm font-medium",
              pathname.startsWith(n.href) ? "bg-brand/10 text-brand" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800")}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-gray-200 pt-3 dark:border-gray-800">
        <button onClick={toggleTheme} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Toggle theme</button>
        <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Sign out</button>
      </div>
    </aside>
  );
}
