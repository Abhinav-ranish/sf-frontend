import {
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
} from "@/lib/nearby/simulation";
import {
  clearUsedNearbyEncounterTokensForTests,
  createNearbyEncounterToken,
  markNearbyEncounterTokenSaved,
  readNearbyEncounterToken,
} from "@/lib/nearby/tokens";

const QUALIFY_DELAY_MS = Math.ceil(
  NEARBY_QUALIFY_AFTER_MS / NEARBY_SIMULATION_SPEED,
);

describe("nearby encounter tokens", () => {
  afterEach(() => {
    clearUsedNearbyEncounterTokensForTests();
  });

  it("requires the server-issued qualification time", () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, 10_000);

    expect(readNearbyEncounterToken(token, 10_000 + QUALIFY_DELAY_MS - 1))
      .toEqual({
        ok: false,
        message: "This encounter has not qualified yet.",
      });
    expect(readNearbyEncounterToken(token, 10_000 + QUALIFY_DELAY_MS))
      .toMatchObject({
        ok: true,
        payload: { profile: { full_name: "Maya Chen" } },
      });
  });

  it("rejects expired and replayed tokens", () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, 10_000);
    const eligibleAt = 10_000 + QUALIFY_DELAY_MS;

    expect(readNearbyEncounterToken(token, 10_000 + 11 * 60 * 1000))
      .toEqual({
        ok: false,
        message: "This encounter token expired.",
      });
    const accepted = readNearbyEncounterToken(token, eligibleAt);
    expect(accepted).toMatchObject({ ok: true });
    if (!accepted.ok) throw new Error("Expected token to be accepted");

    markNearbyEncounterTokenSaved(accepted.payload);

    expect(readNearbyEncounterToken(token, eligibleAt + 1)).toEqual({
      ok: false,
      message: "This encounter has already been saved.",
    });
  });

  it("rejects tampered tokens", () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, 10_000);

    expect(readNearbyEncounterToken(`${token}x`, 10_000 + QUALIFY_DELAY_MS))
      .toEqual({
        ok: false,
        message: "This encounter token is invalid.",
      });
  });
});
