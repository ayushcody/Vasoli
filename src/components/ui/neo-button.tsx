import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all border-brutal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  {
    variants: {
      variant: {
        primary: "bg-cta text-ink shadow-brutal hover:shadow-brutal-hover",
        secondary: "bg-paper-2 text-ink shadow-brutal-sm hover:shadow-brutal",
        ghost: "border-none shadow-none hover:bg-paper-2",
        danger: "bg-danger text-paper-1 shadow-brutal hover:shadow-brutal-hover",
        mustard: "bg-mustard text-ink shadow-brutal hover:shadow-brutal-hover",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-neo",
        md: "h-11 px-6 text-base rounded-neo-md",
        lg: "h-14 px-8 text-lg rounded-neo-md",
        icon: "h-10 w-10 rounded-neo",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const NeoButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
NeoButton.displayName = "NeoButton"

export { NeoButton, buttonVariants }
