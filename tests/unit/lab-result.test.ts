import { describe, it, expect } from "vitest"
import {
  parseResultNumber,
  flagResult,
  flagFromText,
  formatRange,
} from "@/lib/clinical/lab-result"

describe("parseResultNumber", () => {
  it("reads a plain number", () => {
    expect(parseResultNumber("12.5")).toEqual({ value: 12.5, comparator: null })
    expect(parseResultNumber("  98 ")).toEqual({ value: 98, comparator: null })
  })

  it("reads a value with a trailing unit", () => {
    expect(parseResultNumber("12.5 g/dL")).toEqual({ value: 12.5, comparator: null })
  })

  it("strips thousands separators in both western and Indian grouping", () => {
    expect(parseResultNumber("1,200")).toEqual({ value: 1200, comparator: null })
    expect(parseResultNumber("1,234,567")).toEqual({ value: 1234567, comparator: null })
    // Platelet counts get reported this way on Indian reports.
    expect(parseResultNumber("1,50,000")).toEqual({ value: 150000, comparator: null })
    expect(parseResultNumber("12,34,567")).toEqual({ value: 1234567, comparator: null })
  })

  it("refuses a comma that might be a decimal separator", () => {
    // "12,5" means 12.5 in several locales; reading it as 125 would be a
    // tenfold error on a lab value, so it must not parse at all.
    expect(parseResultNumber("12,5")).toBeNull()
  })

  it("keeps censoring comparators", () => {
    expect(parseResultNumber("<0.01")).toEqual({ value: 0.01, comparator: "<" })
    expect(parseResultNumber("> 200")).toEqual({ value: 200, comparator: ">" })
    expect(parseResultNumber("≤5")).toEqual({ value: 5, comparator: "<" })
    expect(parseResultNumber("≥5")).toEqual({ value: 5, comparator: ">" })
  })

  it("refuses a range pasted into the value box", () => {
    // Misreading "5.5-6.0" as 5.5 would flag a normal result as abnormal.
    expect(parseResultNumber("5.5-6.0")).toBeNull()
  })

  it("refuses scientific notation it cannot safely read", () => {
    expect(parseResultNumber("1.2 x 10^3")).toBeNull()
  })

  it("returns null for qualitative results", () => {
    for (const t of ["Negative", "Positive", "Trace", "Nil", "Not detected"]) {
      expect(parseResultNumber(t)).toBeNull()
    }
  })

  it("returns null for empty input", () => {
    expect(parseResultNumber("")).toBeNull()
    expect(parseResultNumber("   ")).toBeNull()
    expect(parseResultNumber(null)).toBeNull()
    expect(parseResultNumber(undefined)).toBeNull()
  })

  it("reads negative values", () => {
    expect(parseResultNumber("-1.5")).toEqual({ value: -1.5, comparator: null })
  })
})

describe("flagResult", () => {
  const val = (v: number) => ({ value: v, comparator: null as null })

  it("flags below, within and above the lab's range", () => {
    expect(flagResult(val(10), 12, 15)).toBe("low")
    expect(flagResult(val(13), 12, 15)).toBe("normal")
    expect(flagResult(val(18), 12, 15)).toBe("high")
  })

  it("treats the bounds themselves as normal", () => {
    expect(flagResult(val(12), 12, 15)).toBe("normal")
    expect(flagResult(val(15), 12, 15)).toBe("normal")
  })

  it("works with a one-sided range", () => {
    expect(flagResult(val(250), null, 200)).toBe("high")
    expect(flagResult(val(150), null, 200)).toBe("normal")
    expect(flagResult(val(30), 40, null)).toBe("low")
    expect(flagResult(val(50), 40, null)).toBe("normal")
  })

  it("does not interpret a result when no range was entered", () => {
    // The whole design: no lab range means no ClinicFlow opinion.
    expect(flagResult(val(10), null, null)).toBeNull()
    expect(flagResult(val(10), undefined, undefined)).toBeNull()
  })

  it("does not interpret an unparseable value", () => {
    expect(flagResult(null, 12, 15)).toBeNull()
  })

  it("resolves a censored value only when the range settles it", () => {
    // "<0.01" against a low of 0.4 is definitely low.
    expect(flagResult({ value: 0.01, comparator: "<" }, 0.4, 4.0)).toBe("low")
    // "<5" inside 1–10 tells us nothing — refuse rather than guess.
    expect(flagResult({ value: 5, comparator: "<" }, 1, 10)).toBeNull()
    expect(flagResult({ value: 200, comparator: ">" }, null, 150)).toBe("high")
    expect(flagResult({ value: 5, comparator: ">" }, 1, 10)).toBeNull()
  })

  it("ignores NaN bounds rather than flagging on them", () => {
    expect(flagResult(val(10), NaN, NaN)).toBeNull()
  })
})

describe("flagFromText", () => {
  it("parses and flags in one step", () => {
    expect(flagFromText("9.8 g/dL", 12, 15)).toBe("low")
    expect(flagFromText("Negative", 12, 15)).toBeNull()
  })
})

describe("formatRange", () => {
  it("renders both, one-sided, and free-text ranges", () => {
    expect(formatRange(12, 15)).toBe("12 – 15")
    expect(formatRange(null, 200)).toBe("< 200")
    expect(formatRange(40, null)).toBe("> 40")
    expect(formatRange(null, null)).toBeNull()
  })

  it("prefers the lab's own free text when given", () => {
    expect(formatRange(12, 15, "12–15 (male)")).toBe("12–15 (male)")
    expect(formatRange(null, null, "Negative")).toBe("Negative")
  })
})
