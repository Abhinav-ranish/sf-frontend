import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { sortHref, type ContactListQuery } from "@/lib/contacts/query";
import type { SortField } from "@/lib/contacts/types";

/**
 * Sortable column header. It is a link, not a button, so sorting works without
 * JavaScript and each sort order is its own URL.
 */
export default function SortHeader({
  field,
  label,
  query,
  className = "",
}: {
  field: SortField;
  label: string;
  query: ContactListQuery;
  className?: string;
}) {
  const active = query.sortBy === field;
  const ariaSort = active
    ? query.order === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-4 py-2.5 ${className}`}>
      <Link
        href={sortHref(query, field)}
        scroll={false}
        className={`inline-flex items-center gap-1 rounded transition-colors ${
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {active ? (
          query.order === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown
            className="h-3.5 w-3.5 opacity-50"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </Link>
    </th>
  );
}
