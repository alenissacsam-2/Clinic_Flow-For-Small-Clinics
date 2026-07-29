import type { MetadataRoute } from "next"
import { env } from "@/lib/env"

/**
 * Only the marketing pages and public booking pages are crawlable. Everything
 * behind auth, plus the tokenized patient surfaces (intake, pay), stays out of
 * the index — those URLs contain a capability token.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/today", "/patients", "/calendar", "/visit", "/billing", "/reports", "/messages", "/settings", "/onboarding", "/intake/", "/pay/", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", env.appUrl).toString(),
  }
}
