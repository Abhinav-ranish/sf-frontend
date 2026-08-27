import React from "react";
import { render, screen } from "@testing-library/react";
import ThemeProvider from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";

const mockPathname = jest.fn(() => "/contacts");
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell>
        <p>page body</p>
      </AppShell>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockPathname.mockReturnValue("/contacts");
});

describe("AppShell", () => {
  it("renders the branding, nav, children and version footer", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "SF Contacts" })).toHaveAttribute(
      "href",
      "/contacts",
    );
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "href",
      "/contacts",
    );
    expect(screen.getByRole("link", { name: "Nearby" })).toHaveAttribute(
      "href",
      "/contacts/nearby",
    );
    expect(screen.getByRole("link", { name: "New contact" })).toHaveAttribute(
      "href",
      "/contacts/new",
    );
    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/^web v/);
  });

  it("marks the current route as active", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("ignores the trailing slash Next adds", () => {
    mockPathname.mockReturnValue("/contacts/");
    renderShell();
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Contacts active on a detail route", () => {
    mockPathname.mockReturnValue("/contacts/7");
    renderShell();
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "New contact" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("switches the active link on the create route", () => {
    mockPathname.mockReturnValue("/contacts/new/");
    renderShell();
    expect(screen.getByRole("link", { name: "New contact" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Contacts" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("switches the active link on the nearby route", () => {
    mockPathname.mockReturnValue("/contacts/nearby/");
    renderShell();
    expect(screen.getByRole("link", { name: "Nearby" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Contacts" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
