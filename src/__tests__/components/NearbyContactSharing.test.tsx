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

function renderNearby(action = createAction()) {
  render(<NearbyContactSharing contacts={CONTACTS} action={action} />);
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
    expect(formData.get("first_name")).toBe("Maya");
    expect(formData.get("email")).toBe("maya.chen@example.com");
    expect(formData.get("website")).toBe("https://maya.example");
    expect(formData.get("private_note")).toBe("Met near the demo table.");
    expect(formData.getAll("shared_field")).not.toContain("notes");
  });
});
