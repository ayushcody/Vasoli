"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Receipt, ScanLine, Target, TrendingUp, BookOpen, Bot, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/browser"

const navigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/app/transactions", icon: Receipt },
  { name: "Cashflow", href: "/app/cashflow", icon: TrendingUp },
  { name: "Receipt Vault", href: "/app/receipts", icon: ScanLine },
  { name: "Goals", href: "/app/goals", icon: Target },
  { name: "Ledger Zine", href: `/app/zine/${new Date().toISOString().slice(0, 7)}`, icon: BookOpen },
  { name: "Marco", href: "/app/marco", icon: Bot },
  { name: "Settings", href: "/app/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="flex h-full w-64 flex-col justify-between border-r-brutal bg-paper-1">
      <div>
        <div className="flex h-16 items-center px-6 border-b-brutal bg-mustard">
          <Link href="/app/dashboard" className="flex items-center">
            <Image src="/vasoli_logo.png" alt="Vasoli" width={100} height={32} priority className="object-contain hover:scale-105 transition-transform" />
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  "group flex items-center gap-3 rounded-neo px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-paper-2 text-ink border-brutal shadow-brutal-sm translate-x-1"
                    : "text-taupe hover:bg-paper-2/50 hover:text-ink hover:translate-x-1"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-ink" : "text-taupe group-hover:text-ink")} />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="p-4 border-t-brutal bg-paper-2/50">
        <button
          onClick={handleSignOut}
          className="group flex w-full items-center gap-3 rounded-neo px-3 py-3 text-sm font-medium text-danger hover:bg-danger/10 hover:shadow-brutal-sm transition-all"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
