import { describe, it, expect } from "vitest"
import { parseScribeJson } from "@/lib/ai/parse"

const EMPTY = { complaints: "", diagnosis: "", advice: "", medicines: [] }

describe("parseScribeJson", () => {
  it("reads a clean JSON reply", () => {
    expect(
      parseScribeJson(
        '{"complaints":"Fever 3 days","diagnosis":"Viral fever","advice":"Rest","medicines":["Dolo 650"]}',
      ),
    ).toEqual({
      complaints: "Fever 3 days",
      diagnosis: "Viral fever",
      advice: "Rest",
      medicines: ["Dolo 650"],
    })
  })

  it("tolerates a fenced block and surrounding prose", () => {
    const raw = 'Here you go:\n```json\n{"complaints":"Cough","diagnosis":"","advice":"","medicines":[]}\n```'
    expect(parseScribeJson(raw).complaints).toBe("Cough")
  })

  it("returns empty fields for a non-JSON reply rather than throwing", () => {
    // A suggestion panel showing nothing is honest; a crash mid-consultation is not.
    expect(parseScribeJson("I could not parse that.")).toEqual(EMPTY)
    expect(parseScribeJson("")).toEqual(EMPTY)
  })

  it("returns empty fields for malformed JSON", () => {
    expect(parseScribeJson('{"complaints": "Fever", ')).toEqual(EMPTY)
  })

  it("coerces wrong-typed fields to empty instead of trusting them", () => {
    const res = parseScribeJson('{"complaints":42,"diagnosis":null,"advice":{},"medicines":"Dolo"}')
    expect(res).toEqual(EMPTY)
  })

  it("drops non-string entries from the medicines list", () => {
    const res = parseScribeJson('{"complaints":"","diagnosis":"","advice":"","medicines":["Dolo",7,null,"  ","Augmentin"]}')
    expect(res.medicines).toEqual(["Dolo", "Augmentin"])
  })

  it("caps the medicines list", () => {
    const many = JSON.stringify({
      complaints: "",
      diagnosis: "",
      advice: "",
      medicines: Array.from({ length: 50 }, (_, i) => `Drug ${i}`),
    })
    expect(parseScribeJson(many).medicines).toHaveLength(20)
  })

  it("trims whitespace off the text fields", () => {
    const res = parseScribeJson('{"complaints":"  Fever  ","diagnosis":"","advice":"","medicines":[]}')
    expect(res.complaints).toBe("Fever")
  })

  it("keeps an empty diagnosis empty — it must never be inferred", () => {
    // The prompt tells the model to leave this blank unless the doctor said it;
    // the parser must not paper over a blank with anything else.
    const res = parseScribeJson('{"complaints":"Headache","diagnosis":"","advice":"","medicines":[]}')
    expect(res.diagnosis).toBe("")
  })
})
