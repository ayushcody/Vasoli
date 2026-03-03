import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  variant?: "default" | "income" | "expense" | "balance"
  className?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, subtitle, icon: Icon, variant = "default", className }, ref) => {
    const variantStyles = {
      default: "bg-paper-2",
      income: "bg-success/10 border-success",
      expense: "bg-danger/10 border-danger",
      balance: "bg-mustard/20 border-mustard",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-neo-md border-brutal p-6 transition-all hover:shadow-brutal-sm",
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium uppercase tracking-wide text-taupe mb-2">
              {title}
            </p>
            <p className="text-3xl font-bold font-serif tabular-nums">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-taupe mt-1">{subtitle}</p>
            )}
          </div>
          <div className="rounded-neo border-brutal p-2 bg-paper-1">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
