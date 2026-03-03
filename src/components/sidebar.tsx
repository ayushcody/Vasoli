"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Receipt, PiggyBank, Target, CalendarDays, BarChart3, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Budgets", href: "/budgets", icon: PiggyBank },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Reminders", href: "/reminders", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
      window.location.href = '/'
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex h-full w-64 flex-col justify-between border-r-brutal bg-paper-1">
      <div>
        <div className="flex h-16 items-center px-6 border-b-brutal bg-mustard">
          <Link href="/dashboard" className="text-xl font-black text-ink tracking-tight uppercase">
            Vasoli
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
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
