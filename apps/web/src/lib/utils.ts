import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format integer rupiah → "Rp 1.250.000" */
export function formatIDR(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID")
}

/** Singkat nominal → "Rp 1,2jt" / "Rp 850rb" */
export function formatIDRShort(amount: number): string {
  if (amount >= 1_000_000)
    return `Rp ${(amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  if (amount >= 1_000)
    return `Rp ${(amount / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`
  return `Rp ${amount}`
}

/** Warna berdasarkan tipe transaksi */
export function txColor(type: "income" | "expense" | "transfer"): string {
  return type === "income" ? "text-green-500" : type === "expense" ? "text-red-400" : "text-blue-400"
}
