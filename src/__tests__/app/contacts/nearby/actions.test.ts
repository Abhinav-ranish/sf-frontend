import {
  loadNearbyShareContactAction,
  saveNearbyEncounterAction,
  startNearbyDiscoveryAction,
} from "@/app/contacts/nearby/actions";
import { ApiUnreachableError } from "@/lib/apiClient";
import { createContact, getContact } from "@/lib/contacts/api";
import type { FormState } from "@/lib/contacts/types";
import {
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
} from "@/lib/nearby/simulation";
import {
  clearUsedNearbyEncounterTokensForTests,
  createNearbyEncounterToken,
  readNearbyEncounterToken,
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
  getContact: jest.fn(),
  apiErrorMessage: jest.fn((_error, fallback: string) => fallback),
  toFieldErrors: jest.fn(() => ({})),
}));

const mockedCreateContact = jest.mocked(createContact);
const mockedGetContact = jest.mocked(getContact);
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
    mockedGetContact.mockResolvedValue(makeContact({ id: 7 }));
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

  it("uses a local placeholder when email is not shared", async () => {
    const token = createNearbyEncounterToken(
      {
        ...SIMULATED_NEARBY_PROFILE,
        sharedFields: ["name", "company"],
      },
      Date.now() - QUALIFY_DELAY_MS - 1,
    );

    await expect(
      saveNearbyEncounterAction(
        { status: "idle" } satisfies FormState,
        encounterForm({ encounter_token: token }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/contacts/77");

    expect(mockedCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Maya",
        last_name: "Chen",
        email: expect.stringMatching(/^nearby-[a-z0-9]+@nearby\.invalid$/),
        company: "Pier 9 Labs",
      }),
    );
  });

  it("allows a retry when the API fails before saving", async () => {
    const formData = encounterForm();
    mockedCreateContact
      .mockRejectedValueOnce(
        new ApiUnreachableError("/api/v1/contacts", new Error("down")),
      )
      .mockResolvedValueOnce(makeContact({ id: 77 }));

    await expect(
      saveNearbyEncounterAction({ status: "idle" }, formData),
    ).resolves.toEqual({
      status: "error",
      message: "Could not reach the Contacts API. Check that the backend is running.",
    });

    await expect(
      saveNearbyEncounterAction({ status: "idle" }, formData),
    ).rejects.toThrow("NEXT_REDIRECT:/contacts/77");
    expect(mockedCreateContact).toHaveBeenCalledTimes(2);
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

describe("startNearbyDiscoveryAction", () => {
  afterEach(() => {
    clearUsedNearbyEncounterTokensForTests();
    jest.useRealTimers();
  });

  it("issues a token from discovery start time", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-27T16:00:00Z"));

    const result = await startNearbyDiscoveryAction();

    expect(result).toMatchObject({
      status: "idle",
      startedAtMs: Date.parse("2026-08-27T16:00:00Z"),
    });
    expect(result.encounterToken).toEqual(expect.any(String));
    expect(
      readNearbyEncounterToken(
        result.encounterToken!,
        Date.parse("2026-08-27T16:00:00Z") + QUALIFY_DELAY_MS - 1,
      ),
    ).toEqual({
      ok: false,
      message: "This encounter has not qualified yet.",
    });
  });
});

describe("loadNearbyShareContactAction", () => {
  beforeEach(() => {
    mockedGetContact.mockResolvedValue(makeContact({ id: 7 }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads only the selected contact fields needed for sharing", async () => {
    await expect(loadNearbyShareContactAction(7)).resolves.toMatchObject({
      id: 7,
      full_name: "Ada Lovelace",
      photo: null,
    });
    expect(mockedGetContact).toHaveBeenCalledWith(7);
  });

  it("rejects invalid contact ids without calling the API", async () => {
    await expect(loadNearbyShareContactAction(0)).resolves.toBeNull();
    expect(mockedGetContact).not.toHaveBeenCalled();
  });
});
