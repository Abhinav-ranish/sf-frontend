import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NearbyContactSharing from "@/components/contacts/NearbyContactSharing";
import type { FormState } from "@/lib/contacts/types";
import { CONTACTS } from "../mocks/handlers";

function createAction() {
  return jest.fn<Promise<FormState>, [FormState, FormData]>(
    async () => ({ status: "idle" }),
  );
}

function renderNearby(
  action = createAction(),
  {
    totalContacts = CONTACTS.length,
    encounterToken = "encounter-token",
  }: { totalContacts?: number; encounterToken?: string } = {},
) {
  render(
    <NearbyContactSharing
      contacts={CONTACTS}
      totalContacts={totalContacts}
      encounterToken={encounterToken}
      action={action}
    />,
  );
  return action;
}

describe("NearbyContactSharing", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders independent sharing controls without exposing notes as shareable", () => {
    renderNearby();

    expect(
      screen.getByRole("checkbox", { name: /share my contact/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /discover nearby people/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Email" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /notes/i })).toBeNull();
    expect(screen.getByText(/private notes are not available/i)).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: /share my contact/i }).closest("label"),
    ).toHaveClass("focus-within:ring-2");
  });

  it("keeps sharing and discovery independent", () => {
    renderNearby();

    fireEvent.click(screen.getByRole("checkbox", { name: /share my contact/i }));

    expect(screen.getByRole("checkbox", { name: /share my contact/i })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /discover nearby people/i }),
    ).not.toBeChecked();
    expect(screen.queryByText("not sharing")).toBeNull();
    expect(screen.getByText(/Discovery is off/i)).toBeVisible();
  });

  it("updates the outgoing card when a share field is removed", () => {
    renderNearby();

    expect(screen.getByRole("link", { name: "ada@example.com" })).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));

    expect(screen.queryByRole("link", { name: "ada@example.com" })).toBeNull();
  });

  it("shows when the source contact selector has more contacts on the API", () => {
    renderNearby(createAction(), { totalContacts: 205 });

    expect(screen.getByText("Showing 2 of 205 contacts.")).toBeVisible();
  });

  it("shows the encounter card only after the simulated close window qualifies", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    renderNearby();

    fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));

    expect(screen.getByText(/nearby signal/i)).toBeVisible();
    expect(screen.queryByText(/You may have met Maya Chen at/i)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(8_000);
    });

    expect(screen.getByText(/You may have met Maya Chen at/i)).toBeVisible();
    expect(screen.getByText("Curated card")).toBeVisible();
    expect(screen.getByRole("button", { name: /save contact/i })).toBeEnabled();
  });

  it("dismisses a qualified encounter and resets discovery", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    renderNearby();

    fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));
    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    expect(screen.getByText(/You may have met Maya Chen at/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(
      screen.getByRole("checkbox", { name: /discover nearby people/i }),
    ).not.toBeChecked();
    expect(screen.queryByText(/You may have met Maya Chen at/i)).toBeNull();
    expect(screen.getByText(/Discovery is off/i)).toBeVisible();
  });

  it("submits the curated shared card and receiver private note", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    const action = renderNearby();

    fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));
    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    jest.useRealTimers();

    fireEvent.change(screen.getByLabelText(/private note/i), {
      target: { value: "Met near the demo table." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("encounter_token")).toBe("encounter-token");
    expect(formData.get("private_note")).toBe("Met near the demo table.");
    expect(formData.has("first_name")).toBe(false);
    expect(formData.has("email")).toBe(false);
    expect(formData.has("website")).toBe(false);
    expect(formData.has("close_for_ms")).toBe(false);
    expect(formData.has("distance_meters")).toBe(false);
    expect(formData.getAll("shared_field")).toHaveLength(0);
  });

  it("shows a clear next action when there is no contact to share", () => {
    render(
      <NearbyContactSharing
        contacts={[]}
        totalContacts={0}
        encounterToken="encounter-token"
        action={createAction()}
      />,
    );

    expect(screen.getByText(/Add a contact before enabling/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /new contact/i })).toHaveAttribute(
      "href",
      "/contacts/new",
    );
    expect(screen.getByText("not sharing")).toBeVisible();
  });
});
