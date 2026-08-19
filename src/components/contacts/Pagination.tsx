import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import {
  contactsHref,
  pageCount,
  type ContactListQuery,
} from "@/lib/contacts/query";

/** Prev/next paging plus the "showing X–Y of Z" range. Links, so no JS needed. */
export default function Pagination({
  query,
  total,
  shown,
}: {
  query: ContactListQuery;
  total: number;
  shown: number;
}) {
  const pages = pageCount(total, query.perPage);
  const firstIndex = (query.page - 1) * query.perPage + 1;
  const lastIndex = firstIndex + shown - 1;

  const hasPrev = query.page > 1;
  const hasNext = query.page < pages;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        {shown === 0 ? (
          "No contacts to show"
        ) : (
          <>
            Showing <span className="text-foreground">{firstIndex}</span>–
            <span className="text-foreground">{lastIndex}</span> of{" "}
            <span className="text-foreground">{total}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground">
          Page {Math.min(query.page, pages)} of {pages}
        </span>

        {hasPrev ? (
          <Link
            href={contactsHref(query, { page: query.page - 1 })}
            scroll={false}
            rel="prev"
            className={buttonClasses("secondary", "sm")}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <span className={`${buttonClasses("secondary", "sm")} opacity-50`} aria-disabled="true">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Previous
          </span>
        )}

        {hasNext ? (
          <Link
            href={contactsHref(query, { page: query.page + 1 })}
            scroll={false}
            rel="next"
            className={buttonClasses("secondary", "sm")}
          >
            Next
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${buttonClasses("secondary", "sm")} opacity-50`} aria-disabled="true">
            Next
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
