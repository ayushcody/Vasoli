import * as React from "react"
import { cn } from "@/lib/utils"

interface NeoProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  variant?: "default" | "success" | "warning" | "danger"
}

const NeoProgress = React.forwardRef<HTMLDivElement, NeoProgressProps>(
  ({ value, max = 100, className, showLabel = false, variant = "default" }, ref) => {
    const percentage = Math.min((value / max) * 100, 100)
    
    const variantColors = {
      default: "bg-cta",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
    }

    return (
      <div ref={ref} className={cn("w-full", className)}>
        {showLabel && (
          <div className="flex justify-between text-sm font-medium mb-2">
            <span className="tabular-nums">{Math.round(percentage)}%</span>
            <span className="tabular-nums text-taupe">
              {value} / {max}
            </span>
          </div>
        )}
        <div className="h-6 w-full rounded-neo border-brutal bg-paper-1 overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500", variantColors[variant])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)
NeoProgress.displayName = "NeoProgress"

export { NeoProgress }
