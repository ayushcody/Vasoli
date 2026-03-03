import * as React from "react"
import { cn } from "@/lib/utils"

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "mustard" | "bordered"
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-neo-md border-brutal p-6",
          variant === "default" && "bg-paper-2",
          variant === "mustard" && "bg-mustard",
          variant === "bordered" && "bg-paper-1",
          className
        )}
        {...props}
      />
    )
  }
)
Panel.displayName = "Panel"

const PanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4 border-b border-ink/30", className)}
    {...props}
  />
))
PanelHeader.displayName = "PanelHeader"

const PanelTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-serif text-2xl font-bold leading-none tracking-tight", className)}
    {...props}
  />
))
PanelTitle.displayName = "PanelTitle"

const PanelDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-taupe", className)}
    {...props}
  />
))
PanelDescription.displayName = "PanelDescription"

const PanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-4", className)} {...props} />
))
PanelContent.displayName = "PanelContent"

export { Panel, PanelHeader, PanelTitle, PanelDescription, PanelContent }
