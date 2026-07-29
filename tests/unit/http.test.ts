import { describe, it, expect } from "vitest"
import { contentDisposition, filenameStem } from "@/lib/http"

/**
 * The regression these guard is a 500, not a cosmetic one: an unencoded
 * non-ASCII filename throws inside the Response constructor, so the route never
 * returns the document at all.
 */
describe("contentDisposition", () => {
  it("produces a header a Response will actually accept for a Devanagari name", () => {
    const value = contentDisposition("attachment", "prescription-अनिता-शर्मा.pdf")
    expect(() => new Response("x", { headers: { "Content-Disposition": value } })).not.toThrow()
  })

  it("accepts Tamil, Bengali and emoji without throwing", () => {
    for (const name of ["அனிதா.pdf", "অনিতা.pdf", "record-🙂.json"]) {
      const value = contentDisposition("attachment", name)
      expect(() => new Response("x", { headers: { "Content-Disposition": value } })).not.toThrow()
    }
  })

  it("keeps the real name in filename* so the patient sees their own name", () => {
    const value = contentDisposition("attachment", "अनिता.pdf")
    expect(value).toContain("filename*=UTF-8''")
    const encoded = value.split("filename*=UTF-8''")[1]
    expect(decodeURIComponent(encoded)).toBe("अनिता.pdf")
  })

  it("falls back to a non-empty ASCII name when the original is entirely non-ASCII", () => {
    const value = contentDisposition("attachment", "अनिता")
    expect(value).toContain('filename="download"')
  })

  it("keeps the ASCII part when the name is mixed", () => {
    const value = contentDisposition("attachment", "prescription-अनिता.pdf")
    expect(value).toContain('filename="prescription-.pdf"')
  })

  it("strips a quote rather than letting it close the quoted-string", () => {
    const value = contentDisposition("attachment", 'evil" ; filename="pwned.pdf')
    const ascii = value.slice(value.indexOf('filename="') + 10, value.indexOf('"; filename*='))
    expect(ascii).not.toContain('"')
    // Exactly one filename= and one filename*= parameter survive.
    expect(value.match(/filename=/g)).toHaveLength(2) // filename= and filename*=
  })

  it("strips path separators and control characters", () => {
    const value = contentDisposition("attachment", "a/b\\c\r\nd.pdf")
    expect(value).toContain('filename="abcd.pdf"')
  })

  it("honours the disposition type", () => {
    expect(contentDisposition("inline", "a.pdf")).toMatch(/^inline;/)
    expect(contentDisposition("attachment", "a.pdf")).toMatch(/^attachment;/)
  })

  it("percent-encodes the characters RFC 5987 requires beyond encodeURIComponent", () => {
    const value = contentDisposition("attachment", "a'b(c)d*e!f.pdf")
    const encoded = value.split("filename*=UTF-8''")[1]
    for (const ch of ["'", "(", ")", "*", "!"]) expect(encoded).not.toContain(ch)
    expect(decodeURIComponent(encoded)).toBe("a'b(c)d*e!f.pdf")
  })
})

describe("filenameStem", () => {
  it("hyphenates whitespace and keeps the script", () => {
    expect(filenameStem("Anita Sharma")).toBe("Anita-Sharma")
    expect(filenameStem("अनिता शर्मा")).toBe("अनिता-शर्मा")
  })

  it("drops characters that are illegal in a filename", () => {
    expect(filenameStem('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij")
  })

  it("falls back when nothing usable is left", () => {
    expect(filenameStem("///", "patient")).toBe("patient")
    expect(filenameStem("   ")).toBe("record")
  })
})
