import type { Contact, ContactInput } from "@/lib/contacts/types";

export const NEARBY_CLOSE_DISTANCE_METERS = 1.5;
export const NEARBY_QUALIFY_AFTER_MS = 90_000;
export const NEARBY_ROTATE_EVERY_MS = 30_000;
export const NEARBY_SIMULATION_SPEED = 12;

export const NEARBY_SHARE_FIELDS = [
  { key: "name", label: "Name" },
  { key: "photo", label: "Photo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "website", label: "Website" },
] as const;

export type NearbyShareField = (typeof NEARBY_SHARE_FIELDS)[number]["key"];

export const DEFAULT_NEARBY_SHARE_FIELDS: NearbyShareField[] = [
  "name",
  "photo",
  "email",
  "phone",
  "company",
  "job_title",
];

export interface NearbySharedProfile {
  peerKey: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  company: string | null;
  job_title: string | null;
  website: string | null;
  sharedFields: NearbyShareField[];
}

export type NearbyShareSourceContact = Pick<
  Contact,
  | "id"
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "job_title"
> & {
  photo?: string | null;
};

export interface NearbyProximitySignal {
  peerKey: string;
  ephemeralId: string;
  distanceMeters: number;
  closeForMs: number;
  detectedAt: string;
  lastSeenAt: string;
}

export interface NearbyEncounter {
  id: string;
  metAt: string;
  signal: NearbyProximitySignal;
  profile: NearbySharedProfile;
}

const DEMO_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

export const SIMULATED_NEARBY_PROFILE: NearbySharedProfile = {
  peerKey: "demo-peer-1",
  first_name: "Maya",
  last_name: "Chen",
  full_name: "Maya Chen",
  email: "maya.chen@example.com",
  phone: "+1-415-555-0198",
  photo: DEMO_PHOTO,
  company: "Pier 9 Labs",
  job_title: "Design Engineer",
  website: "https://maya.example",
  sharedFields: [
    "name",
    "photo",
    "email",
    "phone",
    "company",
    "job_title",
    "website",
  ],
};

const ephemeralIdBuckets = new Map<string, string>();

function opaqueToken(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function normalizeWebsiteUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function randomHex(byteLength: number): string {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  return opaqueToken(`${Date.now()}:${Math.random()}`).repeat(3);
}

export function createEphemeralSeed(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return randomHex(16);
}

export function fieldIsShared(
  profile: Pick<NearbySharedProfile, "sharedFields">,
  field: NearbyShareField,
): boolean {
  return profile.sharedFields.includes(field);
}

export function rotatingEphemeralId(
  rotationSeed: string,
  nowMs: number,
  rotateEveryMs = NEARBY_ROTATE_EVERY_MS,
): string {
  const bucket = Math.floor(nowMs / rotateEveryMs);
  const cacheKey = `${rotationSeed}:${bucket}`;
  let ephemeralId = ephemeralIdBuckets.get(cacheKey);

  if (!ephemeralId) {
    ephemeralId = `eph-${randomHex(10)}`;
    ephemeralIdBuckets.set(cacheKey, ephemeralId);
  }

  return ephemeralId;
}

export function clearEphemeralIdsForTests(): void {
  ephemeralIdBuckets.clear();
}

export function simulatedSignal({
  peerKey,
  rotationSeed,
  startedAtMs,
  nowMs,
  distanceMeters = 0.8,
}: {
  peerKey: string;
  rotationSeed: string;
  startedAtMs: number;
  nowMs: number;
  distanceMeters?: number;
}): NearbyProximitySignal {
  return {
    peerKey,
    ephemeralId: rotatingEphemeralId(rotationSeed, nowMs),
    distanceMeters,
    closeForMs: Math.max(0, (nowMs - startedAtMs) * NEARBY_SIMULATION_SPEED),
    detectedAt: new Date(startedAtMs).toISOString(),
    lastSeenAt: new Date(nowMs).toISOString(),
  };
}

export function qualifiesForEncounter(
  signal: Pick<NearbyProximitySignal, "closeForMs" | "distanceMeters">,
): boolean {
  return (
    signal.distanceMeters <= NEARBY_CLOSE_DISTANCE_METERS &&
    signal.closeForMs >= NEARBY_QUALIFY_AFTER_MS
  );
}

export function resolveSimulatedEncounter(
  signal: NearbyProximitySignal,
  profile = SIMULATED_NEARBY_PROFILE,
): NearbyEncounter | null {
  if (!qualifiesForEncounter(signal)) return null;

  return {
    id: `${signal.peerKey}-${Date.parse(signal.lastSeenAt)}`,
    metAt: signal.lastSeenAt,
    signal: {
      ...signal,
      closeForMs: NEARBY_QUALIFY_AFTER_MS,
    },
    profile,
  };
}

export function contactToOutgoingShare(
  contact: NearbyShareSourceContact,
  sharedFields: NearbyShareField[],
  website: string,
  peerKey: string,
): NearbySharedProfile {
  const shares = new Set(sharedFields);
  const sharesName = shares.has("name");
  const sharedWebsite = shares.has("website")
    ? normalizeWebsiteUrl(website)
    : null;

  return {
    peerKey,
    first_name: sharesName ? contact.first_name : "Nearby",
    last_name: sharesName ? contact.last_name : "Contact",
    full_name: sharesName ? contact.full_name : "Nearby Contact",
    email: shares.has("email") ? contact.email : "",
    phone: shares.has("phone") ? contact.phone : null,
    photo: shares.has("photo") ? contact.photo ?? null : null,
    company: shares.has("company") ? contact.company : null,
    job_title: shares.has("job_title") ? contact.job_title : null,
    website: sharedWebsite,
    sharedFields,
  };
}

export function nearbyProfileToContactInput(
  profile: NearbySharedProfile,
  privateNote: string,
): ContactInput {
  const sharesName = fieldIsShared(profile, "name");
  const website = fieldIsShared(profile, "website")
    ? normalizeWebsiteUrl(profile.website)
    : null;
  const email = fieldIsShared(profile, "email")
    ? profile.email
    : `nearby-${opaqueToken(profile.peerKey)}@nearby.invalid`;
  const noteLines = [
    website ? `Website: ${website}` : null,
    privateNote.trim() || null,
  ].filter(Boolean);

  return {
    first_name: sharesName ? profile.first_name : "Nearby",
    last_name: sharesName ? profile.last_name : "Contact",
    email,
    phone: fieldIsShared(profile, "phone") ? profile.phone : null,
    photo: fieldIsShared(profile, "photo") ? profile.photo : null,
    company: fieldIsShared(profile, "company") ? profile.company : null,
    job_title: fieldIsShared(profile, "job_title") ? profile.job_title : null,
    addresses: [],
    notes: noteLines.length ? noteLines.join("\n\n") : null,
  };
}
