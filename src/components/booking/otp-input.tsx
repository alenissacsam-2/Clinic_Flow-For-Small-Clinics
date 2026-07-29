"use client"

import { useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const LENGTH = 6

/**
 * Six-digit code entry.
 *
 * Built as **one real input sitting invisibly over six drawn boxes**, not six
 * separate inputs. Six inputs is the obvious implementation and it is the
 * wrong one: it breaks paste (a pasted "483920" lands entirely in box one),
 * it fights Android's SMS autofill, it needs hand-rolled focus juggling for
 * backspace and arrow keys, and screen readers announce six unlabelled fields.
 * A single field gets all of that for free from the platform — including
 * `autocomplete="one-time-code"`, which is what makes iOS offer the code from
 * the message above the keyboard.
 *
 * The boxes are `aria-hidden` decoration; the input carries the label.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  label = "Verification code",
}: {
  value: string
  onChange: (next: string) => void
  /** Fired once the sixth digit lands — lets the caller submit without a tap. */
  onComplete?: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  label?: string
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("")
  const activeIndex = Math.min(value.length, LENGTH - 1)

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <input
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, LENGTH)
          onChange(next)
          if (next.length === LENGTH) onComplete?.(next)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        // `pattern` is what tells iOS Safari this field is numeric-only even
        // when the autofill suggestion comes from a message.
        pattern="\d*"
        maxLength={LENGTH}
        aria-invalid={invalid || undefined}
        aria-label={label}
        // Transparent, but genuinely present and full-size: the caret is
        // suppressed because the drawn boxes render their own.
        className="absolute inset-0 z-10 w-full cursor-pointer bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />

      <div aria-hidden className="flex gap-2">
        {digits.map((d, i) => {
          const filled = d !== " "
          const isActive = focused && i === activeIndex && value.length < LENGTH
          return (
            <div
              key={i}
              className={cn(
                "flex h-14 flex-1 items-center justify-center rounded-xl border font-heading text-2xl font-semibold tabular-nums transition-[box-shadow,border-color,background-color] duration-150",
                filled
                  ? "border-primary/40 bg-card text-foreground shadow-nm-raised"
                  : "border-edge/30 bg-background/40 text-muted-foreground shadow-nm-inset",
                isActive && "border-primary ring-2 ring-primary/25",
                invalid && "border-destructive/60",
                disabled && "opacity-60",
              )}
            >
              {filled ? d : isActive ? <Caret /> : ""}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The caret the real input is not allowed to draw. */
function Caret() {
  return <span className="animate-live-dot block h-6 w-px bg-primary" />
}
