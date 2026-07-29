import { describe, it, expect } from "vitest"
import { normalizePhone, isValidPhone, toWhatsAppNumber, formatPhoneDisplay } from "@/lib/format"

describe("normalizePhone", () => {
  it("normalizes a spaced 10-digit number", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210")
  })
  it("strips a leading 0", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210")
  })
  it("accepts +91 prefix", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210")
  })
  it("accepts 91 country code without +", () => {
    expect(normalizePhone("919876543210")).toBe("+919876543210")
  })
  it("rejects numbers starting below 6", () => {
    expect(() => normalizePhone("1234567890")).toThrow()
  })
  it("rejects too-short input", () => {
    expect(() => normalizePhone("98765")).toThrow()
  })
  it("rejects garbage", () => {
    expect(() => normalizePhone("not a phone")).toThrow()
  })
})

describe("helpers", () => {
  it("isValidPhone reflects normalization", () => {
    expect(isValidPhone("9876543210")).toBe(true)
    expect(isValidPhone("123")).toBe(false)
  })
  it("toWhatsAppNumber drops the +", () => {
    expect(toWhatsAppNumber("+919876543210")).toBe("919876543210")
  })
  it("formatPhoneDisplay groups digits", () => {
    expect(formatPhoneDisplay("+919876543210")).toBe("+91 98765 43210")
  })
})
