import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Recessed well: where buttons extrude, fields sink. `border-edge/50`
        // is the WCAG 1.4.11 floor — a field whose only boundary is a soft
        // inner shadow is exactly the failure mode neumorphism is criticised
        // for, and on a prescription form it is a dose typed into the wrong box.
        "h-9 w-full min-w-0 rounded-lg border border-edge/50 bg-background/60 px-3 py-1 text-base shadow-nm-inset transition-[box-shadow,border-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-nm-none aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/25 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
