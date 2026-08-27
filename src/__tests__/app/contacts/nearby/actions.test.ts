import { saveNearbyEncounterAction } from "@/app/contacts/nearby/actions";
import { createContact } from "@/lib/contacts/api";
import type { FormState } from "@/lib/contacts/types";
import { makeContact } from "../../../mocks/handlers";

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

jest.mock("@/lib/contacts/api", () => ({
  createContact: jest.fn(),
  apiErrorMessage: jest.fn((_error, fallback: string) => fallback),
  toFieldErrors: jest.fn(() => ({})),
}));

const mockedCreateContact = jest.mocked(createContact);

function encounterForm(overrides: Record<string, string | string[]> = {}) {
  const formData = new FormData();
  const values: Record<string, string | string[]> = {
    close_for_ms: "90000",
    distance_meters: "0.8",
    peer_key: "maya-chen",
    first_name: "Maya",
    last_name: "Chen",
    email: "maya.chen@example.com",
    phone: "+1-415-555-0198",
    photo: "",
    company: "Pier 9 Labs",
    job_title: "Design Engineer",
    website: "https://maya.example",
    private_note: "Follow up.",
    shared_field: ["name", "email", "phone", "company", "job_title", "website"],
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}

describe("saveNearbyEncounterAction", () => {
  beforeEach(() => {
    mockedCreateContact.mockResolvedValue(makeContact({ id: 77 }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects saves before the encounter qualifies", async () => {
    const result = await saveNearbyEncounterAction(
      { status: "idle" },
      encounterForm({ close_for_ms: "30000" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "This encounter has not qualified yet.",
    });
    expect(mockedCreateContact).not.toHaveBeenCalled();
  });

  it("gates saved contact fields by the shared-field list", async () => {
    await expect(
      saveNearbyEncounterAction(
        { status: "idle" } satisfies FormState,
        encounterForm({ phone: "+1-999-999-9999", shared_field: ["name", "email"] }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/contacts/77");

    expect(mockedCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Maya",
        last_name: "Chen",
        email: "maya.chen@example.com",
        phone: null,
        company: null,
        job_title: null,
      }),
    );
  });
});
