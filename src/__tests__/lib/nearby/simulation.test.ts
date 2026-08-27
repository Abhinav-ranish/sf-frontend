import {
  NEARBY_QUALIFY_AFTER_MS,
  SIMULATED_NEARBY_PROFILE,
  contactToOutgoingShare,
  nearbyProfileToContactInput,
  resolveSimulatedEncounter,
  rotatingEphemeralId,
  simulatedSignal,
} from "@/lib/nearby/simulation";
import { makeContact } from "../../mocks/handlers";

describe("nearby contact sharing simulation", () => {
  it("rotates ephemeral ids independently from shared profile data", () => {
    expect(rotatingEphemeralId("peer", 0)).toBe(rotatingEphemeralId("peer", 29_999));
    expect(rotatingEphemeralId("peer", 0)).not.toBe(
      rotatingEphemeralId("peer", 30_000),
    );
  });

  it("qualifies only after the close-proximity window completes", () => {
    const beforeGate = simulatedSignal({
      peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
      startedAtMs: 0,
      nowMs: 7_000,
    });
    const afterGate = simulatedSignal({
      peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
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
});
