"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Indikator pending untuk sebuah <Link>. useLinkStatus (Next 15.3+)
 * mengembalikan { pending } selama navigasi ke href ini sedang diproses
 * (Server Component tujuan masih fetch). Kita tampilkan spinner kecil
 * supaya user tahu klik-nya "kena" dan tak menekan berulang.
 */
function PendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return pending ? <Loader2 size={14} className={cn("animate-spin shrink-0", className)} /> : null
}

type NavLinkProps = {
  href: string
  active?: boolean
  className?: string
  activeClassName?: string
  idleClassName?: string
  children: React.ReactNode
}

/**
 * <Link> dengan feedback pending bawaan: saat diklik dan halaman tujuan
 * masih dimuat, tampil spinner + gaya "pressed" sehingga navigasi terasa
 * responsif dan tombol tidak seolah bisa diklik berkali-kali tanpa reaksi.
 */
export function NavLink({ href, active, className, activeClassName, idleClassName, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(className, "group/navlink", active ? activeClassName : idleClassName)}
    >
      {children}
      <PendingSpinner className="ml-auto opacity-80" />
    </Link>
  )
}
