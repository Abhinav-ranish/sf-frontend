import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NearbyContactSharing, {
  type NearbyDiscoveryState,
  type NearbyLoadContactAction,
} from "@/components/contacts/NearbyContactSharing";
import type { FormState } from "@/lib/contacts/types";
import type { NearbyShareSourceContact } from "@/lib/nearby/simulation";
import { CONTACTS, makeListItem } from "../mocks/handlers";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

function createAction() {
  return jest.fn<Promise<FormState>, [FormState, FormData]>(
    async () => ({ status: "idle" }),
  );
}

function createStartAction(encounterToken = "encounter-token") {
  return jest.fn<Promise<NearbyDiscoveryState>, []>(async () => ({
    status: "idle",
    encounterToken,
    startedAtMs: Date.now(),
  }));
}

function createLoadContactAction(
  contact: NearbyShareSourceContact | null = null,
) {
  return jest.fn<ReturnType<NearbyLoadContactAction>, Parameters<NearbyLoadContactAction>>(
    async (contactId) =>
      contact ??
      CONTACTS.find((item) => item.id === contactId) ??
      null,
  );
}

function renderNearby(
  action = createAction(),
  {
    totalContacts = CONTACTS.length,
    contacts = CONTACTS,
    encounterToken = "encounter-token",
    startAction = createStartAction(encounterToken),
    loadContactAction = createLoadContactAction(),
  }: {
    totalContacts?: number;
    contacts?: NearbyShareSourceContact[];
    encounterToken?: string;
    startAction?: ReturnType<typeof createStartAction>;
    loadContactAction?: ReturnType<typeof createLoadContactAction>;
  } = {},
) {
  render(
    <NearbyContactSharing
      contacts={contacts}
      totalContacts={totalContacts}
      loadContactAction={loadContactAction}
      startAction={startAction}
      action={action}
    />,
  );
  return { action, startAction, loadContactAction };
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

  it("hydrates the selected contact detail for photo sharing", async () => {
    const { loadContactAction } = renderNearby(createAction(), {
      contacts: CONTACTS.map(makeListItem),
      loadContactAction: createLoadContactAction({
        ...CONTACTS[0],
        photo: PHOTO,
      }),
    });

    await waitFor(() => expect(loadContactAction).toHaveBeenCalledWith(1));
    await waitFor(() => {
      expect(document.querySelector("img")).toHaveAttribute("src", PHOTO);
    });
  });

  it("shows the encounter card only after the simulated close window qualifies", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    renderNearby();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));
    });

    expect(screen.getByText(/nearby signal/i)).toBeVisible();
    expect(screen.queryByText(/You may have met Maya Chen at/i)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(8_000);
    });

    expect(screen.getByText(/You may have met Maya Chen at/i)).toBeVisible();
    expect(screen.getByText("Curated card")).toBeVisible();
    expect(screen.getByRole("button", { name: /save contact/i })).toBeEnabled();
  });

  it("dismisses a qualified encounter and resets discovery", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    renderNearby();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));
    });
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
    const { action, startAction } = renderNearby();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /discover nearby people/i }));
    });
    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    jest.useRealTimers();

    expect(startAction).toHaveBeenCalledTimes(1);
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

  it("ignores stale discovery start responses", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));
    const firstStart = deferred<NearbyDiscoveryState>();
    const secondStart = deferred<NearbyDiscoveryState>();
    const startAction = jest
      .fn<Promise<NearbyDiscoveryState>, []>()
      .mockReturnValueOnce(firstStart.promise)
      .mockReturnValueOnce(secondStart.promise);
    const { action } = renderNearby(createAction(), { startAction });
    const discoverToggle = screen.getByRole("checkbox", {
      name: /discover nearby people/i,
    });

    fireEvent.click(discoverToggle);
    fireEvent.click(discoverToggle);
    fireEvent.click(discoverToggle);

    await act(async () => {
      secondStart.resolve({
        status: "idle",
        encounterToken: "second-token",
        startedAtMs: Date.now(),
      });
      await secondStart.promise;
    });
    await act(async () => {
      firstStart.resolve({
        status: "idle",
        encounterToken: "first-token",
        startedAtMs: Date.now(),
      });
      await firstStart.promise;
    });

    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    jest.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: /save contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    expect(action.mock.calls[0][1].get("encounter_token")).toBe("second-token");
  });

  it("shows a clear next action when there is no contact to share", () => {
    render(
      <NearbyContactSharing
        contacts={[]}
        totalContacts={0}
        loadContactAction={createLoadContactAction()}
        startAction={createStartAction()}
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
