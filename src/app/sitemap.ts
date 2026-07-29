import type { MetadataRoute } from "next"
import { env } from "@/lib/env"

const abs = (path: string) => new URL(path, env.appUrl).toString()

/**
 * Marketing surface only. Clinic booking pages are intentionally left out —
 * a clinic's page is shared directly by the doctor, not discovered via search,
 * and listing every tenant would leak the customer list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: abs("/"), changeFrequency: "monthly", priority: 1 },
    { url: abs("/login"), changeFrequency: "yearly", priority: 0.3 },
    { url: abs("/signup"), changeFrequency: "yearly", priority: 0.6 },
    { url: abs("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: abs("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ]
}
