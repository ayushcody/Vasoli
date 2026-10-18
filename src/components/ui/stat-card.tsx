import * as React from "react"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  variant?: "default" | "income" | "expense" | "balance"
  className?: string
  href?: string
  trend?: "up" | "down" | "neutral"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, subtitle, icon: Icon, variant = "default", className, href, trend }, ref) => {
    const variantStyles = {
      default: "bg-paper-2",
      income: "bg-success/10 border-success",
      expense: "bg-danger/10 border-danger",
      balance: "bg-mustard/20 border-mustard",
    }

    const content = (
      <div
        ref={ref}
        className={cn(
          "rounded-neo-md border-brutal p-6 transition-all hover:shadow-brutal-sm group h-full",
          href && "hover:border-ink hover:-translate-y-1 cursor-pointer",
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium uppercase tracking-wide text-taupe mb-2">
              {title}
            </p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold font-serif tabular-nums text-ink transition-colors group-hover:text-black">
                {value}
              </p>
              {trend && (
                <span className={cn(
                  "mb-1 text-sm font-bold",
                  trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-taupe"
                )}>
                  {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-taupe mt-1">{subtitle}</p>
            )}
          </div>
          <div className="rounded-neo border-brutal p-2 bg-paper-1">
            <Icon className="h-5 w-5 text-ink" />
          </div>
        </div>
      </div>
    )

    if (href) {
      return <Link href={href} className="block h-full">{content}</Link>
    }

    return content
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
