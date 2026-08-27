import {
  NEARBY_QUALIFY_AFTER_MS,
  SIMULATED_NEARBY_PROFILE,
  clearEphemeralIdsForTests,
  contactToOutgoingShare,
  nearbyProfileToContactInput,
  normalizeWebsiteUrl,
  resolveSimulatedEncounter,
  rotatingEphemeralId,
  simulatedSignal,
} from "@/lib/nearby/simulation";
import { makeContact } from "../../mocks/handlers";

describe("nearby contact sharing simulation", () => {
  afterEach(() => {
    clearEphemeralIdsForTests();
  });

  it("rotates ephemeral ids independently from shared profile data", () => {
    const firstBucket = rotatingEphemeralId("random-seed", 0);

    expect(firstBucket).toMatch(/^eph-/);
    expect(firstBucket).toBe(rotatingEphemeralId("random-seed", 29_999));
    expect(firstBucket).not.toBe(rotatingEphemeralId("random-seed", 30_000));
    expect(rotatingEphemeralId("local-1", 0)).not.toContain("local");
  });

  it("qualifies only after the close-proximity window completes", () => {
    const beforeGate = simulatedSignal({
      peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
      rotationSeed: "random-seed",
      startedAtMs: 0,
      nowMs: 7_000,
    });
    const afterGate = simulatedSignal({
      peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
      rotationSeed: "random-seed",
      startedAtMs: 0,
      nowMs: 8_000,
    });

    expect(beforeGate.closeForMs).toBeLessThan(NEARBY_QUALIFY_AFTER_MS);
    expect(Object.keys(beforeGate)).not.toContain("profile");
    expect(resolveSimulatedEncounter(beforeGate)).toBeNull();
    expect(resolveSimulatedEncounter(afterGate)).toMatchObject({
      profile: { full_name: "Maya Chen" },
      signal: { closeForMs: NEARBY_QUALIFY_AFTER_MS },
    });
  });

  it("never includes private notes in the outgoing share payload", () => {
    const share = contactToOutgoingShare(
      makeContact({ notes: "internal reminder" }),
      ["name", "email", "company"],
      "https://ada.example",
    );

    expect("notes" in share).toBe(false);
    expect(share.email).toBe("ada@example.com");
    expect(share.phone).toBeNull();
    expect(share.website).toBeNull();
  });

  it("normalizes website sharing to http and https URLs", () => {
    expect(normalizeWebsiteUrl("https://maya.example")).toBe("https://maya.example");
    expect(normalizeWebsiteUrl("http://maya.example")).toBe("http://maya.example");
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsiteUrl("maya.example")).toBeNull();
  });

  it("maps an accepted shared card to the existing contact input shape", () => {
    const input = nearbyProfileToContactInput(
      SIMULATED_NEARBY_PROFILE,
      "Follow up about the prototype.",
    );

    expect(input).toMatchObject({
      first_name: "Maya",
      last_name: "Chen",
      email: "maya.chen@example.com",
      addresses: [],
      notes: "Website: https://maya.example\n\nFollow up about the prototype.",
    });
  });

  it("does not persist unshared name or email values", () => {
    const input = nearbyProfileToContactInput(
      {
        ...SIMULATED_NEARBY_PROFILE,
        sharedFields: ["company"],
      },
      "",
    );

    expect(input.first_name).toBe("Nearby");
    expect(input.last_name).toBe("Contact");
    expect(input.email).toBe("");
    expect(input.company).toBe("Pier 9 Labs");
  });
});
