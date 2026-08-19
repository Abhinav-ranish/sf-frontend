import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsToolbar from "@/components/contacts/ContactsToolbar";
import { DEFAULT_LIST_QUERY } from "@/lib/contacts/query";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => replace(...args) }),
}));

beforeEach(() => replace.mockClear());

describe("ContactsToolbar", () => {
  it("pushes the search term into the URL after the debounce", async () => {
    render(<ContactsToolbar query={DEFAULT_LIST_QUERY} />);

    await userEvent.type(screen.getByRole("searchbox"), "ada");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/contacts?q=ada", { scroll: false }),
    );
    // Debounced: one navigation for three keystrokes.
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("resets to the first page when the term changes", async () => {
    render(
      <ContactsToolbar query={{ ...DEFAULT_LIST_QUERY, search: "a", page: 4 }} />,
    );

    await userEvent.type(screen.getByRole("searchbox"), "da");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/contacts?q=ada", { scroll: false }),
    );
  });

  it("does not navigate when the term has not changed", async () => {
    render(<ContactsToolbar query={{ ...DEFAULT_LIST_QUERY, search: "ada" }} />);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears the search", async () => {
    render(<ContactsToolbar query={{ ...DEFAULT_LIST_QUERY, search: "ada" }} />);

    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/contacts", { scroll: false }),
    );
  });

  it("changes the page size", async () => {
    render(<ContactsToolbar query={DEFAULT_LIST_QUERY} />);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /contacts per page/i }),
      "50",
    );

    expect(replace).toHaveBeenCalledWith("/contacts?perPage=50", {
      scroll: false,
    });
  });
});
