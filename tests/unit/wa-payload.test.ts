import { describe, expect, it } from "vitest"

import { toCloudApiPayload } from "@/lib/whatsapp/client"
import type { Outbound } from "@/lib/whatsapp/bot/types"

/**
 * The reducer's `Outbound` → Meta Cloud API mapping.
 *
 * Worth asserting directly: a wrong key here is invisible in every unit test
 * that stops at the reducer, and surfaces in production as a numeric error code
 * from Meta and a bot that silently stops replying mid-conversation.
 */

const TO = "919876543210"

describe("Cloud API payload mapping", () => {
  it("sends plain text with link previews off", () => {
    const p = toCloudApiPayload(TO, { type: "text", body: "Booked. Sat, 15 Aug at 10:00 AM." })
    expect(p).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: TO,
      type: "text",
      // Off deliberately: a clinical message should not send a preview fetch to
      // whatever a date string happens to look like.
      text: { body: "Booked. Sat, 15 Aug at 10:00 AM.", preview_url: false },
    })
  })

  it("maps reply buttons into interactive/button", () => {
    const out: Outbound = {
      type: "buttons",
      body: "Shall I book it?",
      buttons: [
        { id: "confirm", title: "Yes, book it" },
        { id: "days", title: "Change time" },
      ],
    }
    expect(toCloudApiPayload(TO, out)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: TO,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Shall I book it?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "confirm", title: "Yes, book it" } },
            { type: "reply", reply: { id: "days", title: "Change time" } },
          ],
        },
      },
    })
  })

  it("maps a sectioned list into interactive/list", () => {
    const out: Outbound = {
      type: "list",
      body: "Which one works?",
      button: "Choose a time",
      sections: [
        {
          title: "Morning",
          rows: [{ id: "slot:2026-08-15T04:30:00.000Z", title: "10:00 AM" }],
        },
        {
          title: "Choose a time",
          rows: [{ id: "days", title: "Another day" }],
        },
      ],
    }
    const p = toCloudApiPayload(TO, out) as {
      interactive: { type: string; action: { button: string; sections: unknown[] } }
    }
    expect(p.interactive.type).toBe("list")
    expect(p.interactive.action.button).toBe("Choose a time")
    expect(p.interactive.action.sections).toEqual([
      { title: "Morning", rows: [{ id: "slot:2026-08-15T04:30:00.000Z", title: "10:00 AM" }] },
      { title: "Choose a time", rows: [{ id: "days", title: "Another day" }] },
    ])
  })

  it("omits description entirely rather than sending an empty one", () => {
    // Meta rejects `description: ""` on a list row; the key has to be absent.
    const out: Outbound = {
      type: "list",
      body: "Which day?",
      button: "Choose a day",
      sections: [
        {
          title: "Choose a day",
          rows: [
            { id: "day:2026-08-15", title: "Today, 15 Aug", description: "4 times open" },
            { id: "day:2026-08-16", title: "Tomorrow, 16 Aug" },
          ],
        },
      ],
    }
    const p = toCloudApiPayload(TO, out) as {
      interactive: { action: { sections: { rows: Record<string, unknown>[] }[] } }
    }
    const rows = p.interactive.action.sections[0].rows
    expect(rows[0].description).toBe("4 times open")
    expect("description" in rows[1]).toBe(false)
  })

  it("always identifies the product and recipient type", () => {
    for (const out of [
      { type: "text", body: "x" },
      { type: "buttons", body: "x", buttons: [{ id: "a", title: "A" }] },
      { type: "list", body: "x", button: "B", sections: [{ title: "S", rows: [{ id: "r", title: "R" }] }] },
    ] as Outbound[]) {
      const p = toCloudApiPayload(TO, out)
      expect(p.messaging_product).toBe("whatsapp")
      expect(p.recipient_type).toBe("individual")
      expect(p.to).toBe(TO)
    }
  })
})
