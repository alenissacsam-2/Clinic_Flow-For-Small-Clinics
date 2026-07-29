import { describe, it, expect } from "vitest"
import {
  verhoeffValidate,
  verhoeffCheckDigit,
  normalizeAbhaNumber,
  formatAbhaNumber,
  checkAbhaNumber,
  normalizeAbhaAddress,
  checkAbhaAddress,
} from "@/lib/abdm/abha"

// Hand-computed against the Verhoeff tables, not produced by the code under
// test — this is the independent anchor the ABHA cases build on.
const VALID_ABHA = "91112233445564"

describe("Verhoeff", () => {
  it("computes the documented check digit for 236", () => {
    // The canonical worked example in the literature: 236 → 3.
    expect(verhoeffCheckDigit("236")).toBe(3)
    expect(verhoeffValidate("2363")).toBe(true)
  })

  it("rejects a single-digit error", () => {
    expect(verhoeffValidate("2364")).toBe(false)
    expect(verhoeffValidate("2463")).toBe(false)
  })

  it("rejects an adjacent transposition", () => {
    // Catching transpositions is the whole reason Verhoeff beats a mod-10 sum.
    expect(verhoeffValidate("2633")).toBe(false)
  })

  it("round-trips: appending its own check digit always validates", () => {
    for (const payload of ["0", "1234567890123", "9999999999999", "4815162342"]) {
      expect(verhoeffValidate(`${payload}${verhoeffCheckDigit(payload)}`)).toBe(true)
    }
  })

  it("rejects non-digits rather than coercing them", () => {
    expect(verhoeffValidate("23a3")).toBe(false)
    // The empty string folds to 0, so the digits-only guard — not the fold —
    // is what stops it being reported as a valid checksum.
    expect(verhoeffValidate("")).toBe(false)
    expect(() => verhoeffCheckDigit("12x")).toThrow()
  })
})

describe("normalizeAbhaNumber", () => {
  it("strips the display separators", () => {
    expect(normalizeAbhaNumber("91-1122-3344-5564")).toBe(VALID_ABHA)
    expect(normalizeAbhaNumber("91 1122 3344 5564")).toBe(VALID_ABHA)
  })

  it("returns empty for input with no digits", () => {
    expect(normalizeAbhaNumber("not a number")).toBe("")
  })
})

describe("formatAbhaNumber", () => {
  it("groups 14 digits as 2-4-4-4", () => {
    expect(formatAbhaNumber(VALID_ABHA)).toBe("91-1122-3344-5564")
  })

  it("leaves anything that is not 14 digits alone", () => {
    expect(formatAbhaNumber("123")).toBe("123")
  })
})

describe("checkAbhaNumber", () => {
  it("accepts a well-formed, correctly-checksummed number", () => {
    expect(checkAbhaNumber("91-1122-3344-5564")).toEqual({
      value: VALID_ABHA,
      wellFormed: true,
      checksumValid: true,
    })
  })

  it("reports a bad checksum without calling it malformed", () => {
    // Same 14 digits, last one bumped: shape is fine, checksum is not.
    const res = checkAbhaNumber("91112233445565")
    expect(res.wellFormed).toBe(true)
    expect(res.checksumValid).toBe(false)
  })

  it("flags the wrong length", () => {
    expect(checkAbhaNumber("911122334455").wellFormed).toBe(false)
    expect(checkAbhaNumber("911122334455644").wellFormed).toBe(false)
  })

  it("never reports a checksum as valid when the length is wrong", () => {
    // Guards the ordering in checkAbhaNumber: a short string can still fold
    // to 0, and reporting that as "valid" would be misleading.
    expect(checkAbhaNumber("2363").checksumValid).toBe(false)
  })
})

describe("checkAbhaAddress", () => {
  it("accepts a handle with a domain", () => {
    const res = checkAbhaAddress("Aarav.Shah@sbx")
    expect(res).toMatchObject({ value: "aarav.shah@sbx", valid: true, handle: "aarav.shah", domain: "sbx" })
  })

  it("accepts a bare handle", () => {
    expect(checkAbhaAddress("aaravshah").valid).toBe(true)
  })

  it("enforces the 8–18 character handle length", () => {
    expect(checkAbhaAddress("aarav").valid).toBe(false) // 5
    expect(checkAbhaAddress("aaravsha").valid).toBe(true) // 8
    expect(checkAbhaAddress("a".repeat(18)).valid).toBe(true) // 18
    expect(checkAbhaAddress("a".repeat(19)).valid).toBe(false) // 19
  })

  it("requires a leading letter and an alphanumeric ending", () => {
    expect(checkAbhaAddress("1aravshah").valid).toBe(false)
    expect(checkAbhaAddress("aaravshah.").valid).toBe(false)
    expect(checkAbhaAddress("aaravshah_").valid).toBe(false)
  })

  it("rejects a second @", () => {
    expect(checkAbhaAddress("aaravshah@sbx@abdm").valid).toBe(false)
  })

  it("does not hardcode a domain allow-list", () => {
    // NHA has shipped several suffixes; a new one must not be rejected.
    expect(checkAbhaAddress("aaravshah@abdm").valid).toBe(true)
    expect(checkAbhaAddress("aaravshah@somefuturedomain").valid).toBe(true)
  })
})

describe("normalizeAbhaAddress", () => {
  it("trims and lowercases", () => {
    expect(normalizeAbhaAddress("  Aarav.Shah@SBX  ")).toBe("aarav.shah@sbx")
  })
})
