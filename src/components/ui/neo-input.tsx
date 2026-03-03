import * as React from "react"
import { cn } from "@/lib/utils"

export interface NeoInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const NeoInput = React.forwardRef<HTMLInputElement, NeoInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-neo border-brutal bg-paper-2 px-4 py-2 text-base",
          "placeholder:text-taupe",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
NeoInput.displayName = "NeoInput"

export { NeoInput }
