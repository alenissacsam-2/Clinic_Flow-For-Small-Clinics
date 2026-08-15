import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tactile button — the primary expression of the neumorphic system.
 *
 * Three states, all driven by the dual-light-source vars in `globals.css`:
 *   rest    → `shadow-nm-raised`  (extruded from the plane)
 *   hover   → `shadow-nm-float`   (lifts, glow blooms)
 *   active  → `shadow-nm-pressed` (pushes IN, the shadow inverts)
 *
 * The press is the point: inverting an outer shadow to an inner one is what
 * makes the control feel like a physical key rather than a rectangle that
 * changed colour. It's paired with a 1px `translate-y` so the label travels
 * with the surface.
 *
 * `border-edge` is not decoration — it is the WCAG 1.4.11 contract described
 * at the top of `globals.css`. Neumorphic controls are otherwise the same
 * colour as their background and fail 3:1 non-text contrast by construction.
 * `ghost` and `link` skip it: their label text carries the affordance, so
 * there is no boundary that needs to be perceivable on its own.
 *
 * Every variant and size name is unchanged from the previous system, so no
 * call site across the app needed touching.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center",
    "rounded-lg border border-transparent bg-clip-padding",
    "text-sm font-semibold whitespace-nowrap select-none",
    "transition-[box-shadow,transform,background-color,color] duration-150 ease-out",
    "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-nm-none",
    "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/25",
    "active:not-aria-[haspopup]:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // Solid indigo. The shadow is indigo-tinted rather than neutral grey —
        // a coloured key lit by the same lamp, not a grey key with a sticker.
        // It casts straight down and carries no white highlight leg: on warm
        // bone a white bloom around a dark button reads as a halo, not a lift.
        default: [
          "bg-primary text-primary-foreground border-primary/30",
          "shadow-[0_4px_10px_color-mix(in_oklab,var(--primary)_38%,transparent)]",
          "hover:bg-[color-mix(in_oklab,var(--primary),white_8%)]",
          "hover:shadow-[0_7px_18px_color-mix(in_oklab,var(--primary)_48%,transparent)]",
          "active:not-aria-[haspopup]:shadow-[inset_3px_3px_8px_color-mix(in_oklab,black_28%,transparent),inset_-3px_-3px_8px_color-mix(in_oklab,white_18%,transparent)]",
        ],
        // The canonical Soft-UI control: same colour as the plane, pure extrusion.
        outline: [
          "border-edge/55 bg-background text-foreground shadow-nm-raised",
          "hover:shadow-nm-float hover:text-primary hover:border-edge/70",
          "active:not-aria-[haspopup]:shadow-nm-pressed",
          "aria-expanded:shadow-nm-pressed aria-expanded:text-primary",
        ],
        secondary: [
          "border-edge/45 bg-secondary text-secondary-foreground shadow-nm-raised",
          "hover:shadow-nm-float hover:text-primary",
          "active:not-aria-[haspopup]:shadow-nm-pressed",
          "aria-expanded:shadow-nm-pressed",
        ],
        // Flat at rest; hovering carves it INTO the plane instead of lifting it.
        // Reads as a recessed slot — the inverse gesture to the raised variants.
        ghost: [
          "text-foreground shadow-nm-none",
          "hover:bg-muted/60 hover:shadow-nm-inset hover:text-primary",
          "active:not-aria-[haspopup]:shadow-nm-pressed",
          "aria-expanded:bg-muted/60 aria-expanded:shadow-nm-inset",
        ],
        destructive: [
          "border-destructive/35 bg-destructive/12 text-destructive shadow-nm-raised",
          "hover:bg-destructive/20 hover:shadow-nm-float",
          "active:not-aria-[haspopup]:shadow-nm-pressed",
          "focus-visible:border-destructive/50 focus-visible:ring-destructive/25",
        ],
        link: "text-primary underline-offset-4 hover:underline shadow-nm-none",
      },
      size: {
        // Heights lifted one step across the board. h-8/32px was under every
        // touch-target guideline, and neumorphic depth needs padding to read —
        // the shadow has to fall somewhere that isn't the label.
        default:
          "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        // 44px — a real touch target, for the primary action on a page.
        lg: "h-11 gap-2 rounded-xl px-5 text-[0.95rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-[1.05rem]",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
      /** Vertical travel on press. Off for popup triggers, whose panel is anchored. */
      travel: {
        true: "active:not-aria-[haspopup]:translate-y-[1.5px]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      travel: true,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  travel = true,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, travel, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
