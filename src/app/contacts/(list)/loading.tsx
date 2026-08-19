/**
 * Skeleton shown while the server component fetches the page of contacts.
 *
 * It lives in the `(list)` route group on purpose: a `loading.tsx` directly
 * under `contacts/` would wrap `[id]` too, flushing the HTML shell before the
 * detail page can call `notFound()` — which would turn its 404 into a 200.
 */
export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8" aria-busy="true">
      <span className="sr-only">Loading contacts…</span>

      <div className="h-8 w-40 animate-pulse rounded-md bg-secondary" />
      <div className="h-9 w-full animate-pulse rounded-md bg-secondary" />

      <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
            <div className="h-4 flex-1 animate-pulse rounded bg-secondary" />
            <div className="hidden h-4 w-48 animate-pulse rounded bg-secondary sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
