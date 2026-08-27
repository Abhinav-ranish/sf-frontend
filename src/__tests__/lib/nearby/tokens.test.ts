import {
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
} from "@/lib/nearby/simulation";
import {
  clearUsedNearbyEncounterTokensForTests,
  consumeNearbyEncounterToken,
  createNearbyEncounterToken,
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

    expect(consumeNearbyEncounterToken(token, 10_000 + QUALIFY_DELAY_MS - 1))
      .toEqual({
        ok: false,
        message: "This encounter has not qualified yet.",
      });
    expect(consumeNearbyEncounterToken(token, 10_000 + QUALIFY_DELAY_MS))
      .toMatchObject({
        ok: true,
        payload: { profile: { full_name: "Maya Chen" } },
      });
  });

  it("rejects expired and replayed tokens", () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, 10_000);
    const eligibleAt = 10_000 + QUALIFY_DELAY_MS;

    expect(consumeNearbyEncounterToken(token, 10_000 + 11 * 60 * 1000))
      .toEqual({
        ok: false,
        message: "This encounter token expired.",
      });
    expect(consumeNearbyEncounterToken(token, eligibleAt)).toMatchObject({
      ok: true,
    });
    expect(consumeNearbyEncounterToken(token, eligibleAt + 1)).toEqual({
      ok: false,
      message: "This encounter has already been saved.",
    });
  });

  it("rejects tampered tokens", () => {
    const token = createNearbyEncounterToken(SIMULATED_NEARBY_PROFILE, 10_000);

    expect(consumeNearbyEncounterToken(`${token}x`, 10_000 + QUALIFY_DELAY_MS))
      .toEqual({
        ok: false,
        message: "This encounter token is invalid.",
      });
  });
});
