"use client";
import { clsx } from "./clsx";

export function Button({ className, variant = "primary", ...p }: any) {
  const styles: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-700",
    ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
    outline: "border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
  };
  return (
    <button
      className={clsx("inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50", styles[variant], className)}
      {...p}
    />
  );
}

export function Card({ className, children }: any) {
  return <div className={clsx("rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900", className)}>{children}</div>;
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={clsx("mt-1 text-2xl font-semibold", accent)}>{value}</p>
    </Card>
  );
}

export function Input(p: any) {
  return <input {...p} className={clsx("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-gray-700 dark:bg-gray-900", p.className)} />;
}

export function Select(p: any) {
  return <select {...p} className={clsx("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-gray-700 dark:bg-gray-900", p.className)} />;
}

export function Textarea(p: any) {
  return <textarea {...p} className={clsx("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-gray-700 dark:bg-gray-900", p.className)} />;
}

export function Label({ children }: any) {
  return <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{children}</label>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-gray-200 dark:bg-gray-800", className)} />;
}
