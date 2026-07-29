import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logoUrlFromPath } from "@/lib/clinic"
import { DisplayBoard, type QueueSnapshot } from "@/components/display/display-board"

// The board must never be served from a cache — a stale queue on a waiting-room
// wall is worse than no board at all.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return {
    title: "Waiting room",
    // A wall display should never be indexed, and never previewed in chat.
    robots: { index: false, follow: false },
    alternates: { canonical: `/display/${slug}` },
  }
}

export default async function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc("get_display_queue", { p_slug: slug })
  const snapshot = data as unknown as QueueSnapshot | null

  if (!snapshot?.found) notFound()

  return (
    <DisplayBoard
      slug={slug}
      initial={snapshot}
      logoUrl={logoUrlFromPath(snapshot.clinic.logo_path)}
    />
  )
}
