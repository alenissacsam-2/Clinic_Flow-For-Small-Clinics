/**
 * Offline draft queue for the visit editor.
 *
 * ── What this is, and what it is not ─────────────────────────────────
 * A clinic in a patchy-network area must not lose a consultation because the
 * connection dropped mid-visit. Every edit is written to IndexedDB on the
 * device; when the save fails or the browser is offline, the draft stays
 * queued and is replayed on reconnect.
 *
 * It is **not** a full offline app: pages still need the network to load, and
 * this does not pretend otherwise. The claim is narrow and true — *the
 * consultation you are in the middle of will not be lost*. Overstating it
 * would be worse than not having it, because a doctor would rely on it.
 *
 * IndexedDB rather than localStorage: localStorage is synchronous (it janks
 * typing) and capped at ~5 MB shared across the origin. Drafts are small, but
 * a queue that silently stops accepting writes is the exact failure this is
 * meant to prevent.
 */

const DB_NAME = "clinicflow-offline"
const DB_VERSION = 1
const STORE = "visit-drafts"

export type VisitDraft = {
  /** Appointment id, or `visit:<id>` when there is no appointment. */
  key: string
  payload: unknown
  updatedAt: number
  /** Set once a save has been attempted and failed. */
  pending: boolean
}

/** IndexedDB is absent in SSR, in some private modes, and in old WebViews. */
export function offlineAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!offlineAvailable()) return Promise.reject(new Error("IndexedDB unavailable"))
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Could not open the offline store"))
  })
  // A failed open must not be cached forever — the next call should retry.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error("Offline store write failed"))
      }),
  )
}

/**
 * Save a draft locally. Never throws — a failure here must not take down the
 * editor the doctor is typing into; the online save is still the primary path.
 */
export async function putDraft(key: string, payload: unknown, pending: boolean): Promise<void> {
  if (!offlineAvailable()) return
  try {
    const draft: VisitDraft = { key, payload, updatedAt: Date.now(), pending }
    await tx("readwrite", (s) => s.put(draft))
  } catch {
    // Swallowed on purpose — see above.
  }
}

export async function getDraft(key: string): Promise<VisitDraft | null> {
  if (!offlineAvailable()) return null
  try {
    const row = await tx<VisitDraft | undefined>("readonly", (s) => s.get(key))
    return row ?? null
  } catch {
    return null
  }
}

export async function deleteDraft(key: string): Promise<void> {
  if (!offlineAvailable()) return
  try {
    await tx("readwrite", (s) => s.delete(key))
  } catch {
    // ignore
  }
}

/** Every draft still waiting to reach the server. */
export async function pendingDrafts(): Promise<VisitDraft[]> {
  if (!offlineAvailable()) return []
  try {
    const rows = await tx<VisitDraft[]>("readonly", (s) => s.getAll())
    return (rows ?? []).filter((r) => r.pending).sort((a, b) => a.updatedAt - b.updatedAt)
  } catch {
    return []
  }
}

/** Best-effort online check. `navigator.onLine` false is reliable; true is not. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false
}
