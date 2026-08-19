import Link from "next/link";
import { Plus, SearchX, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

/** Shown when the list has nothing in it — either truly empty or filtered out. */
export default function EmptyState({
  searchTerm,
  clearHref,
}: {
  searchTerm?: string;
  clearHref: string;
}) {
  const filtered = Boolean(searchTerm);
  const Icon = filtered ? SearchX : Users;

  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <Icon
        className="mx-auto h-8 w-8 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h2 className="mt-4 font-display text-base font-semibold text-foreground">
        {filtered ? "No matching contacts" : "No contacts yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered ? (
          <>
            Nothing matches <span className="text-foreground">“{searchTerm}”</span>.
            Try a shorter term, or clear the search.
          </>
        ) : (
          "Add the first one and it will show up here."
        )}
      </p>

      <div className="mt-6 flex justify-center gap-2">
        {filtered ? (
          <Link href={clearHref} className={buttonClasses("secondary")}>
            Clear search
          </Link>
        ) : null}
        <Link href="/contacts/new" className={buttonClasses("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          New contact
        </Link>
      </div>
    </div>
  );
}
