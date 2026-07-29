import { describe, it, expect } from "vitest"
import { buildUpiLink, isValidVpa } from "@/lib/upi"

describe("isValidVpa", () => {
  it("accepts well-formed VPAs", () => {
    expect(isValidVpa("doctor@okhdfcbank")).toBe(true)
    expect(isValidVpa("clinic.pay-1@ybl")).toBe(true)
    expect(isValidVpa("9876543210@paytm")).toBe(true)
  })
  it("rejects malformed VPAs", () => {
    expect(isValidVpa("doctor")).toBe(false)
    expect(isValidVpa("doctor@")).toBe(false)
    expect(isValidVpa("@bank")).toBe(false)
    expect(isValidVpa("a b@bank")).toBe(false)
  })
})

describe("buildUpiLink", () => {
  it("builds a correct upi:// link with encoded params", () => {
    const link = buildUpiLink({ vpa: "doctor@okhdfcbank", name: "Sunrise Clinic", amount: 300, note: "INV-26-0001" })
    expect(link).toContain("upi://pay?")
    expect(link).toContain("pa=doctor%40okhdfcbank")
    expect(link).toContain("pn=Sunrise+Clinic")
    expect(link).toContain("am=300.00")
    expect(link).toContain("cu=INR")
    expect(link).toContain("tn=INV-26-0001")
  })
  it("formats the amount to two decimals", () => {
    expect(buildUpiLink({ vpa: "ab@bank", name: "X", amount: 51.5 })).toContain("am=51.50")
  })
  it("returns null for an invalid VPA", () => {
    expect(buildUpiLink({ vpa: "nope", name: "X", amount: 10 })).toBeNull()
  })
})
