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
const LOCAL_DEMO_SECRET = "sf-contacts-nearby-local-demo-secret";
const MISSING_SECRET_MESSAGE =
  "Set NEARBY_TOKEN_SECRET before using nearby sharing in production.";
// Demo-scoped replay state. A real multi-instance/native proximity detector
// should replace this with an atomic durable nonce claim store.
const usedNonces = new Map<string, number>();
const pendingNonces = new Map<string, number>();

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

function tokenSecret(): string {
  const secret =
    process.env.NEARBY_TOKEN_SECRET ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;

  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(MISSING_SECRET_MESSAGE);
  }

  return LOCAL_DEMO_SECRET;
}

function tokenKey(): Buffer {
  return createHash("sha256").update(tokenSecret()).digest();
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

function cleanupNonces(nowMs: number): void {
  for (const [nonce, expiresAt] of usedNonces) {
    if (expiresAt < nowMs) usedNonces.delete(nonce);
  }
  for (const [nonce, expiresAt] of pendingNonces) {
    if (expiresAt < nowMs) pendingNonces.delete(nonce);
  }
}

function payloadIsValid(value: unknown): value is NearbyEncounterTokenPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as NearbyEncounterTokenPayload;
  return (
    typeof payload.nonce === "string" &&
    Number.isFinite(payload.issuedAt) &&
    Number.isFinite(payload.eligibleAt) &&
    Number.isFinite(payload.expiresAt) &&
    Boolean(payload.profile) &&
    typeof payload.profile.peerKey === "string" &&
    Array.isArray(payload.profile.sharedFields)
  );
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

export function readNearbyEncounterToken(
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
    );

    if (!payloadIsValid(payload)) {
      return { ok: false, message: "This encounter token is invalid." };
    }
    if (nowMs < payload.eligibleAt) {
      return { ok: false, message: "This encounter has not qualified yet." };
    }
    if (nowMs > payload.expiresAt) {
      return { ok: false, message: "This encounter token expired." };
    }

    cleanupNonces(nowMs);
    if (usedNonces.has(payload.nonce)) {
      return { ok: false, message: "This encounter has already been saved." };
    }
    if (pendingNonces.has(payload.nonce)) {
      return { ok: false, message: "This encounter is already being saved." };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, message: "This encounter token is invalid." };
  }
}

export function reserveNearbyEncounterToken(
  payload: NearbyEncounterTokenPayload,
  nowMs = Date.now(),
): NearbyEncounterTokenResult {
  cleanupNonces(nowMs);

  if (usedNonces.has(payload.nonce)) {
    return { ok: false, message: "This encounter has already been saved." };
  }
  if (pendingNonces.has(payload.nonce)) {
    return { ok: false, message: "This encounter is already being saved." };
  }

  pendingNonces.set(payload.nonce, payload.expiresAt);
  return { ok: true, payload };
}

export function markNearbyEncounterTokenSaved(
  payload: NearbyEncounterTokenPayload,
): void {
  pendingNonces.delete(payload.nonce);
  usedNonces.set(payload.nonce, payload.expiresAt);
}

export function releaseNearbyEncounterToken(
  payload: NearbyEncounterTokenPayload,
): void {
  pendingNonces.delete(payload.nonce);
}

export function clearUsedNearbyEncounterTokensForTests(): void {
  usedNonces.clear();
  pendingNonces.clear();
}
