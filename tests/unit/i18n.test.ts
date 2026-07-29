import { describe, it, expect } from "vitest"
import {
  LOCALES,
  translator,
  resolveLocale,
  isLocale,
  englishKeys,
  dictionaryFor,
  LOCALE_LABELS,
} from "@/lib/i18n"

describe("resolveLocale", () => {
  it("accepts supported locales", () => {
    expect(resolveLocale("hi")).toBe("hi")
    expect(resolveLocale("ta")).toBe("ta")
  })

  it("falls back to English for anything else", () => {
    expect(resolveLocale("fr")).toBe("en")
    expect(resolveLocale(null)).toBe("en")
    expect(resolveLocale(undefined)).toBe("en")
    expect(resolveLocale("")).toBe("en")
  })
})

describe("isLocale", () => {
  it("narrows correctly", () => {
    expect(isLocale("hi")).toBe(true)
    expect(isLocale("de")).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})

describe("translator", () => {
  it("returns the translation for the locale", () => {
    expect(translator("hi")("book.token")).toBe("टोकन")
    expect(translator("en")("book.token")).toBe("Token")
  })

  it("falls back to English for a key that locale has not translated yet", () => {
    // Marathi has no intake strings; a patient must still get a readable page.
    const t = translator("mr")
    expect(t("intake.submit")).toBe("Send to the clinic")
  })

  it("returns the key only when English has no string either", () => {
    expect(translator("en")("nope.missing")).toBe("nope.missing")
  })

  it("substitutes {name} placeholders", () => {
    expect(translator("en")("display.aboutMinutes", { n: 25 })).toBe("about 25 min")
  })

  it("substitutes into the fallback string too", () => {
    // Marathi does translate this one; Tamil's copy has the number in the
    // middle. Either way the placeholder must be filled, not printed.
    for (const locale of LOCALES) {
      expect(translator(locale)("display.aboutMinutes", { n: 10 })).not.toContain("{n}")
    }
  })

  it("leaves an unknown placeholder alone rather than printing 'undefined'", () => {
    expect(translator("en")("display.aboutMinutes", { other: 1 })).toContain("{n}")
  })

  it("is unchanged when no vars are passed", () => {
    expect(translator("en")("display.estWait")).toBe("Estimated wait")
  })
})

describe("dictionary integrity", () => {
  it("labels every supported locale", () => {
    for (const l of LOCALES) expect(LOCALE_LABELS[l]).toBeTruthy()
  })

  it("never defines a key English does not have", () => {
    // A stray key in a translation is dead weight — it can never be reached,
    // because lookups start from what the UI asks for.
    const known = new Set(englishKeys())
    for (const locale of LOCALES) {
      for (const key of Object.keys(dictionaryFor(locale))) {
        expect(known, `${locale}: ${key}`).toContain(key)
      }
    }
  })

  it("resolves every English key in every locale to a non-empty string", () => {
    for (const locale of LOCALES) {
      const t = translator(locale)
      for (const key of englishKeys()) {
        expect(t(key), `${locale}: ${key}`).toBeTruthy()
      }
    }
  })

  it("translates the whole waiting-room board into Hindi", () => {
    // The board is read by patients who may not read English at all, so this
    // surface is the one that must be complete, not merely fallback-safe.
    const hi = dictionaryFor("hi")
    for (const key of englishKeys().filter((k) => k.startsWith("display."))) {
      expect(hi[key], key).toBeTruthy()
    }
  })
})
