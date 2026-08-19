import {
  DEFAULT_PER_PAGE,
  MAX_LIMIT,
  MIN_LIMIT,
  PER_PAGE_OPTIONS,
  SORT_FIELDS,
  type SortField,
  type SortOrder,
} from "./types";

/**
 * The contacts list keeps its state in the URL: search, sort, and page are all
 * search params, so every view is linkable, shareable, and server-rendered.
 */

export interface ContactListQuery {
  search: string;
  sortBy: SortField;
  order: SortOrder;
  /** 1-based, for humans; converted to `offset` for the API. */
  page: number;
  perPage: number;
}

export const DEFAULT_LIST_QUERY: ContactListQuery = {
  search: "",
  sortBy: "last_name",
  order: "asc",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

/** Next hands route params as `string | string[] | undefined`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Parse (and sanitise) the list state out of the URL. Bad input falls back. */
export function parseContactListQuery(
  searchParams: RawSearchParams = {},
): ContactListQuery {
  const sortBy = first(searchParams.sort);
  const order = first(searchParams.order);
  const page = Number.parseInt(first(searchParams.page), 10);
  const perPage = Number.parseInt(first(searchParams.perPage), 10);

  return {
    search: first(searchParams.q),
    sortBy: (SORT_FIELDS as readonly string[]).includes(sortBy)
      ? (sortBy as SortField)
      : DEFAULT_LIST_QUERY.sortBy,
    order: order === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) ? Math.max(page, 1) : 1,
    perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perPage)
      ? clamp(perPage, MIN_LIMIT, MAX_LIMIT)
      : DEFAULT_LIST_QUERY.perPage,
  };
}

/** Build a `/contacts` URL, omitting anything that is already the default. */
export function contactsHref(
  query: ContactListQuery,
  overrides: Partial<ContactListQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.search) params.set("q", next.search);
  if (next.sortBy !== DEFAULT_LIST_QUERY.sortBy) params.set("sort", next.sortBy);
  if (next.order !== DEFAULT_LIST_QUERY.order) params.set("order", next.order);
  if (next.perPage !== DEFAULT_LIST_QUERY.perPage) {
    params.set("perPage", String(next.perPage));
  }
  if (next.page > 1) params.set("page", String(next.page));

  const search = params.toString();
  return search ? `/contacts?${search}` : "/contacts";
}

/**
 * Clicking a column header sorts by it ascending; clicking the active column
 * flips the direction. Either way the user goes back to page 1.
 */
export function sortHref(query: ContactListQuery, field: SortField): string {
  const isActive = query.sortBy === field;
  return contactsHref(query, {
    sortBy: field,
    order: isActive && query.order === "asc" ? "desc" : "asc",
    page: 1,
  });
}

export function toApiParams(query: ContactListQuery) {
  return {
    search: query.search || undefined,
    limit: query.perPage,
    offset: (query.page - 1) * query.perPage,
    sortBy: query.sortBy,
    order: query.order,
  };
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
