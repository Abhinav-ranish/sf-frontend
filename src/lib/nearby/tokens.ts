import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
  type NearbySharedProfile,
} from "@/lib/nearby/simulation";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 10 * 60 * 1000;
const processLocalTokenKey = randomBytes(32);
const usedNonces = new Map<string, number>();

export interface NearbyEncounterTokenPayload {
  profile: NearbySharedProfile;
  issuedAt: number;
  eligibleAt: number;
  expiresAt: number;
  nonce: string;
}

type NearbyEncounterTokenResult =
  | { ok: true; payload: NearbyEncounterTokenPayload }
  | { ok: false; message: string };

function tokenKey(): Buffer {
  const secret =
    process.env.NEARBY_TOKEN_SECRET ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;

  return secret ? createHash("sha256").update(secret).digest() : processLocalTokenKey;
}

function encode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function demoEligibleAt(nowMs: number): number {
  return nowMs + Math.ceil(NEARBY_QUALIFY_AFTER_MS / NEARBY_SIMULATION_SPEED);
}

export function createNearbyEncounterToken(
  profile: NearbySharedProfile = SIMULATED_NEARBY_PROFILE,
  nowMs = Date.now(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const payload: NearbyEncounterTokenPayload = {
    profile,
    issuedAt: nowMs,
    eligibleAt: demoEligibleAt(nowMs),
    expiresAt: nowMs + TOKEN_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return [
    TOKEN_VERSION,
    encode(iv),
    encode(cipher.getAuthTag()),
    encode(ciphertext),
  ].join(".");
}

export function consumeNearbyEncounterToken(
  token: string,
  nowMs = Date.now(),
): NearbyEncounterTokenResult {
  const [version, iv, tag, ciphertext] = token.split(".");
  if (version !== TOKEN_VERSION || !iv || !tag || !ciphertext) {
    return { ok: false, message: "This encounter token is invalid." };
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(), decode(iv));
    decipher.setAuthTag(decode(tag));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(decode(ciphertext)),
        decipher.final(),
      ]).toString("utf8"),
    ) as NearbyEncounterTokenPayload;

    if (nowMs < payload.eligibleAt) {
      return { ok: false, message: "This encounter has not qualified yet." };
    }
    if (nowMs > payload.expiresAt) {
      return { ok: false, message: "This encounter token expired." };
    }
    for (const [nonce, expiresAt] of usedNonces) {
      if (expiresAt < nowMs) usedNonces.delete(nonce);
    }

    if (usedNonces.has(payload.nonce)) {
      return { ok: false, message: "This encounter has already been saved." };
    }

    usedNonces.set(payload.nonce, payload.expiresAt);
    return { ok: true, payload };
  } catch {
    return { ok: false, message: "This encounter token is invalid." };
  }
}

export function clearUsedNearbyEncounterTokensForTests(): void {
  usedNonces.clear();
}
