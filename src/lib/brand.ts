import "server-only"
import { readFileSync } from "fs"
import { join } from "path"

/** Base64 data URI of the ClinicFlow brand mark (ivory tile), for use in `next/og` ImageResponse JSX. */
export function brandMarkDataUri(): string {
  const bytes = readFileSync(join(process.cwd(), "public", "brand", "mark-tile.png"))
  return `data:image/png;base64,${bytes.toString("base64")}`
}
