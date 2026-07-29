import { test, expect } from "@playwright/test"

const SLUG = process.env.E2E_CLINIC_SLUG ?? "sunrise-clinic"

test.describe("marketing + auth gate", () => {
  test("landing page renders and links to signup", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("clinic day")
    await expect(page.getByRole("link", { name: /create your clinic/i })).toBeVisible()
  })

  test("protected routes redirect anonymous users to login", async ({ page }) => {
    for (const path of ["/today", "/patients", "/settings", "/billing"]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })
})

test.describe("crawler surfaces", () => {
  // These are fetched by unauthenticated bots (WhatsApp, Google). If the auth
  // proxy ever swallows them, link previews and indexing break silently.
  test("robots.txt is public and hides the authenticated app", async ({ request }) => {
    const res = await request.get("/robots.txt")
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain("Disallow: /settings")
    expect(body).toContain("Disallow: /intake/")
    expect(body).toContain("Sitemap:")
  })

  test("sitemap.xml is public", async ({ request }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain("<urlset")
  })

  test("site OG image renders", async ({ request }) => {
    const res = await request.get("/opengraph-image")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("image/png")
  })
})

test.describe("public booking page", () => {
  test("shows the clinic and offers slots", async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    await expect(page.getByRole("heading", { name: /sunrise clinic/i })).toBeVisible()
  })

  test("previews as the clinic, not as ClinicFlow", async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    // The link doctors share on WhatsApp must carry per-clinic OG tags.
    await expect(page).toHaveTitle(/Sunrise Clinic/)
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute("content", /Sunrise Clinic/)
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content")
    expect(ogImage).toContain(`/book/${SLUG}/opengraph-image`)
  })

  test("per-clinic OG image renders as PNG", async ({ request }) => {
    const res = await request.get(`/book/${SLUG}/opengraph-image`)
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("image/png")
  })

  test("unknown clinic slug 404s", async ({ page }) => {
    const res = await page.goto("/book/definitely-not-a-real-clinic")
    expect(res?.status()).toBe(404)
  })

  test("slots are grouped by part of day", async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    // At least one of the three headings must be present on an open clinic.
    // Flat grids of thirty near-identical times are what this replaced.
    const groups = page.getByText(/^(Morning|Afternoon|Evening)$/, { exact: true })
    expect(await groups.count()).toBeGreaterThan(0)
  })

  test("day chips say why a day has no slots", async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    // Every chip carries a count or a reason — never a silently dead button.
    const chipStates = page.getByText(/^(\d+ free|Closed|Full)$/)
    expect(await chipStates.count()).toBeGreaterThan(0)
  })

  test("a day with no slots is disabled, not merely faded", async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    for (const label of ["Closed", "Full"]) {
      const chip = page.getByText(label, { exact: true }).first()
      if (!(await chip.count())) continue
      const button = chip.locator("xpath=ancestor::button[1]")
      await expect(button).toBeDisabled()
    }
  })
})

test.describe("waiting-room board", () => {
  test("renders the clinic and the queue labels", async ({ page }) => {
    await page.goto(`/display/${SLUG}`)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/sunrise clinic/i)
    await expect(page.getByRole("heading", { name: /now in consultation/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /next in line/i })).toBeVisible()
  })

  test("is never indexed — it is a screen in a private room", async ({ page }) => {
    await page.goto(`/display/${SLUG}`)
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute("content", /noindex/)
  })

  test("unknown clinic slug 404s", async ({ page }) => {
    const res = await page.goto("/display/definitely-not-a-real-clinic")
    expect(res?.status()).toBe(404)
  })
})
