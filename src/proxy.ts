import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"

/**
 * Refreshes the Supabase auth session on every request and gates the
 * authenticated app. Public routes (booking page, auth, api) are excluded
 * via the matcher below and the allowlist here.
 * (Next 16 renamed the `middleware` convention to `proxy`.)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/book") ||
    path.startsWith("/intake") ||
    path.startsWith("/pay") ||
    // The waiting-room board hangs on a wall, unattended and never logged in.
    path.startsWith("/display") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    // Crawler / link-preview surfaces. These are fetched by unauthenticated
    // bots (WhatsApp, Google), so they must never redirect to /login.
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/opengraph-image") ||
    path.startsWith("/twitter-image") ||
    path.startsWith("/icon")

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return response
}

/**
 * Anything matched here runs the auth gate, so every static asset served from
 * `public/` must be excluded by extension or it 307s to /login for exactly the
 * logged-out visitors the landing page exists for. The video extensions are
 * here because the hero background lives at `/hero.mp4`.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm)$).*)",
  ],
}
