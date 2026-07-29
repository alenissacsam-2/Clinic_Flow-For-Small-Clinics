/**
 * Vitest stand-in for the `server-only` package.
 *
 * The real module throws unless it is imported in a React Server Component
 * graph, which makes any module marked `import "server-only"` impossible to
 * unit test. Aliasing it here (see `vitest.config.ts`) keeps the marker doing
 * its job in the app build while letting the tests import server modules
 * directly — previously the workaround was to split pure logic out into a
 * second file purely so it could be reached (see `src/lib/ai/parse.ts`).
 */
export {}
