import { saveNearbyEncounterAction } from "@/app/contacts/nearby/actions";
import { createContact } from "@/lib/contacts/api";
import type { FormState } from "@/lib/contacts/types";
import {
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
} from "@/lib/nearby/simulation";
import {
  clearUsedNearbyEncounterTokensForTests,
  createNearbyEncounterToken,
} from "@/lib/nearby/tokens";
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
const QUALIFY_DELAY_MS = Math.ceil(
  NEARBY_QUALIFY_AFTER_MS / NEARBY_SIMULATION_SPEED,
);

function encounterForm(overrides: Record<string, string | string[]> = {}) {
  const formData = new FormData();
  const values: Record<string, string | string[]> = {
    encounter_token: createNearbyEncounterToken(
      SIMULATED_NEARBY_PROFILE,
      Date.now() - QUALIFY_DELAY_MS - 1,
    ),
    private_note: "Follow up.",
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
    clearUsedNearbyEncounterTokensForTests();
    mockedCreateContact.mockResolvedValue(makeContact({ id: 77 }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects saves before the encounter qualifies", async () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, Date.now());
    const result = await saveNearbyEncounterAction(
      { status: "idle" },
      encounterForm({ encounter_token: token, close_for_ms: "90000" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "This encounter has not qualified yet.",
    });
    expect(mockedCreateContact).not.toHaveBeenCalled();
  });

  it("gates saved contact fields by the shared-field list", async () => {
    const token = createNearbyEncounterToken(
      {
        ...SIMULATED_NEARBY_PROFILE,
        sharedFields: ["name", "email"],
      },
      Date.now() - QUALIFY_DELAY_MS - 1,
    );

    await expect(
      saveNearbyEncounterAction(
        { status: "idle" } satisfies FormState,
        encounterForm({
          encounter_token: token,
          phone: "+1-999-999-9999",
          shared_field: ["name", "email", "phone", "company"],
        }),
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

  it("rejects replayed encounter tokens", async () => {
    const formData = encounterForm();

    await expect(
      saveNearbyEncounterAction({ status: "idle" }, formData),
    ).rejects.toThrow("NEXT_REDIRECT:/contacts/77");

    mockedCreateContact.mockClear();

    await expect(
      saveNearbyEncounterAction({ status: "idle" }, formData),
    ).resolves.toEqual({
      status: "error",
      message: "This encounter has already been saved.",
    });
    expect(mockedCreateContact).not.toHaveBeenCalled();
  });
});
