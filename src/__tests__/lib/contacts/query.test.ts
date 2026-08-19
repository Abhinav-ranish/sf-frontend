import {
  DEFAULT_LIST_QUERY,
  contactsHref,
  pageCount,
  parseContactListQuery,
  sortHref,
  toApiParams,
} from "@/lib/contacts/query";

describe("parseContactListQuery", () => {
  it("falls back to the defaults when nothing is set", () => {
    expect(parseContactListQuery({})).toEqual(DEFAULT_LIST_QUERY);
  });

  it("reads search, sort, order, page and page size", () => {
    expect(
      parseContactListQuery({
        q: " lovelace ",
        sort: "email",
        order: "desc",
        page: "3",
        perPage: "50",
      }),
    ).toEqual({
      search: "lovelace",
      sortBy: "email",
      order: "desc",
      page: 3,
      perPage: 50,
    });
  });

  it("rejects a sort field outside the API's allow-list", () => {
    expect(parseContactListQuery({ sort: "password" }).sortBy).toBe(
      DEFAULT_LIST_QUERY.sortBy,
    );
  });

  it("rejects a page size outside the offered options", () => {
    expect(parseContactListQuery({ perPage: "9999" }).perPage).toBe(
      DEFAULT_LIST_QUERY.perPage,
    );
  });

  it("clamps a nonsense page to the first one", () => {
    expect(parseContactListQuery({ page: "-4" }).page).toBe(1);
    expect(parseContactListQuery({ page: "abc" }).page).toBe(1);
  });

  it("takes the first value when a param repeats", () => {
    expect(parseContactListQuery({ q: ["ada", "grace"] }).search).toBe("ada");
  });
});

describe("contactsHref", () => {
  it("omits everything that is already the default", () => {
    expect(contactsHref(DEFAULT_LIST_QUERY)).toBe("/contacts");
  });

  it("serialises only what differs", () => {
    expect(contactsHref(DEFAULT_LIST_QUERY, { search: "ada", page: 2 })).toBe(
      "/contacts?q=ada&page=2",
    );
  });

  it("round-trips through the parser", () => {
    const query = {
      search: "ada",
      sortBy: "company",
      order: "desc",
      page: 4,
      perPage: 10,
    } as const;

    const href = contactsHref(DEFAULT_LIST_QUERY, query);
    const params = Object.fromEntries(
      new URL(href, "http://localhost").searchParams,
    );

    expect(parseContactListQuery(params)).toEqual(query);
  });
});

describe("sortHref", () => {
  it("sorts ascending on a new column", () => {
    expect(sortHref(DEFAULT_LIST_QUERY, "email")).toBe("/contacts?sort=email");
  });

  it("flips the direction on the active column", () => {
    expect(sortHref(DEFAULT_LIST_QUERY, DEFAULT_LIST_QUERY.sortBy)).toBe(
      "/contacts?order=desc",
    );
  });

  it("returns to the first page", () => {
    const onPageFive = { ...DEFAULT_LIST_QUERY, page: 5 };
    expect(sortHref(onPageFive, "email")).not.toContain("page=");
  });
});

describe("toApiParams", () => {
  it("turns a 1-based page into an offset", () => {
    expect(toApiParams({ ...DEFAULT_LIST_QUERY, page: 3, perPage: 10 })).toEqual({
      search: undefined,
      limit: 10,
      offset: 20,
      sortBy: "last_name",
      order: "asc",
    });
  });
});

describe("pageCount", () => {
  it("never reports fewer than one page", () => {
    expect(pageCount(0, 25)).toBe(1);
  });

  it("rounds partial pages up", () => {
    expect(pageCount(26, 25)).toBe(2);
  });
});
