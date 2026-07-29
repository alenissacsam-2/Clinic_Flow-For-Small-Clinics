import { describe, it, expect } from "vitest"
import { csvCell, csvNumber, toCsv } from "@/lib/csv"

describe("csvCell", () => {
  it("neutralises every leading character a spreadsheet evaluates", () => {
    // A patient can book under any name, so these arrive from the public page.
    for (const payload of [
      '=HYPERLINK("http://evil","Click")',
      "+cmd|' /C calc'!A0",
      "-2+3+cmd|' /C calc'!A0",
      "@SUM(1+1)*cmd|' /C calc'!A0",
    ]) {
      const out = csvCell(payload)
      expect(out.startsWith(`"'`)).toBe(true)
    }
  })

  it("guards a leading tab or carriage return too", () => {
    expect(csvCell("\t=1+1")).toBe(`"'\t=1+1"`)
    expect(csvCell("\r=1+1")).toBe(`"'\r=1+1"`)
  })

  it("leaves an ordinary name untouched apart from quoting", () => {
    expect(csvCell("Anita Sharma")).toBe('"Anita Sharma"')
    expect(csvCell("अनिता शर्मा")).toBe('"अनिता शर्मा"')
  })

  it("does not guard a formula character that is not leading", () => {
    expect(csvCell("Smith=Jones")).toBe('"Smith=Jones"')
  })

  it("doubles embedded quotes so the field stays well-formed", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""')
  })

  it("keeps commas and newlines inside the quoted field", () => {
    expect(csvCell("Sharma, Anita")).toBe('"Sharma, Anita"')
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"')
  })

  it("renders null and undefined as an empty cell", () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
})

describe("csvNumber", () => {
  it("emits a bare number so the spreadsheet keeps it numeric", () => {
    expect(csvNumber(450)).toBe("450.00")
    expect(csvNumber(1234.567)).toBe("1234.57")
  })

  it("does not guard a negative amount into a string", () => {
    // The whole reason numbers have their own path: `-500` must stay a number.
    expect(csvNumber(-500)).toBe("-500.00")
    expect(csvNumber(-500).startsWith("'")).toBe(false)
  })

  it("renders a missing or non-finite amount as an empty cell, not NaN", () => {
    expect(csvNumber(null)).toBe("")
    expect(csvNumber(undefined)).toBe("")
    expect(csvNumber(Number.NaN)).toBe("")
    expect(csvNumber(Number.POSITIVE_INFINITY)).toBe("")
  })

  it("honours the requested precision", () => {
    expect(csvNumber(3, 0)).toBe("3")
  })
})

describe("toCsv", () => {
  it("joins with CRLF and quotes the header", () => {
    const out = toCsv(["Date", "Amount"], [[csvCell("today"), csvNumber(10)]])
    expect(out).toBe('"Date","Amount"\r\n"today",10.00')
  })

  it("survives an injected name end to end", () => {
    const out = toCsv(["Patient"], [[csvCell("=1+1")]])
    expect(out.split("\r\n")[1]).toBe(`"'=1+1"`)
  })
})
