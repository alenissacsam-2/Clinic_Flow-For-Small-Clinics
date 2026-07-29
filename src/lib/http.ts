/**
 * Content-Disposition, built the way the spec actually requires.
 *
 * ── Why this is not a template literal ───────────────────────────────────────
 * HTTP header values are byte strings. `new Response(body, { headers })` throws
 * a TypeError the moment a value contains a code point above 255:
 *
 *     Cannot convert argument to a ByteString because the character at
 *     index 35 has a value of 2309 which is greater than 255.
 *
 * The prescription PDF route built its filename from the patient's name. This
 * application ships Hindi, Marathi and Tamil translations and serves Indian
 * clinics — so a patient called अनिता शर्मा or அனிதா did not get a badly named
 * download, they got a 500 and no prescription at all. The failure is in the
 * header, long before the PDF (which renders those names fine) is ever sent.
 *
 * A patient name is also not trusted input: it arrives through the public
 * booking page. A `"` in it would close the quoted-string early and let the
 * rest of the name be read as further header parameters.
 *
 * RFC 6266 solves both. `filename=` carries a sanitised ASCII fallback for
 * anything old, and `filename*=` carries the real UTF-8 name percent-encoded
 * per RFC 5987. Every current browser prefers `filename*`, so the patient gets
 * their own name on the file and nothing can escape the header.
 */

/** Percent-encode per RFC 5987 — stricter than encodeURIComponent. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*!]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/**
 * A filename safe to put inside a quoted-string: printable ASCII only, with
 * quotes, backslashes and path separators removed rather than escaped — a
 * download name has no business containing a path.
 */
function asciiFallback(filename: string): string {
  const cleaned = filename
    // Drop everything outside printable ASCII. Control characters (which could
    // inject a header) and non-Latin scripts (which would throw) go together.
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || "download"
}

/**
 * Build a Content-Disposition header value.
 *
 * @param type      `attachment` to force a save dialog, `inline` to render in-tab.
 * @param filename  The name to offer, in any script.
 */
export function contentDisposition(type: "attachment" | "inline", filename: string): string {
  return `${type}; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encodeRfc5987(filename)}`
}

/**
 * Turn a person's name into a filename stem: collapse whitespace to hyphens
 * and drop characters that are awkward in a filename on any OS. The script
 * itself is preserved — `contentDisposition` is what makes it transmissible.
 */
export function filenameStem(name: string, fallback = "record"): string {
  const stem = name
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "-")
  return stem || fallback
}
