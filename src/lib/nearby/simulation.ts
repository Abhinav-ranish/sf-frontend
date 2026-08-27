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
  peerKey: "maya-chen",
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

export function fieldIsShared(
  profile: Pick<NearbySharedProfile, "sharedFields">,
  field: NearbyShareField,
): boolean {
  return profile.sharedFields.includes(field);
}

export function rotatingEphemeralId(
  peerKey: string,
  nowMs: number,
  rotateEveryMs = NEARBY_ROTATE_EVERY_MS,
): string {
  return `eph-${peerKey}-${Math.floor(nowMs / rotateEveryMs).toString(36)}`;
}

export function simulatedSignal({
  peerKey,
  startedAtMs,
  nowMs,
  distanceMeters = 0.8,
}: {
  peerKey: string;
  startedAtMs: number;
  nowMs: number;
  distanceMeters?: number;
}): NearbyProximitySignal {
  return {
    peerKey,
    ephemeralId: rotatingEphemeralId(peerKey, nowMs),
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
  contact: Contact,
  sharedFields: NearbyShareField[],
  website: string,
): NearbySharedProfile {
  const shares = new Set(sharedFields);
  const sharesName = shares.has("name");

  return {
    peerKey: `local-${contact.id}`,
    first_name: sharesName ? contact.first_name : "Nearby",
    last_name: sharesName ? contact.last_name : "Contact",
    full_name: sharesName ? contact.full_name : "Nearby Contact",
    email: shares.has("email") ? contact.email : "",
    phone: shares.has("phone") ? contact.phone : null,
    photo: shares.has("photo") ? contact.photo : null,
    company: shares.has("company") ? contact.company : null,
    job_title: shares.has("job_title") ? contact.job_title : null,
    website: shares.has("website") ? website.trim() || null : null,
    sharedFields,
  };
}

export function nearbyProfileToContactInput(
  profile: NearbySharedProfile,
  privateNote: string,
): ContactInput {
  const website = fieldIsShared(profile, "website") ? profile.website : null;
  const noteLines = [
    website ? `Website: ${website}` : null,
    privateNote.trim() || null,
  ].filter(Boolean);

  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone: fieldIsShared(profile, "phone") ? profile.phone : null,
    photo: fieldIsShared(profile, "photo") ? profile.photo : null,
    company: fieldIsShared(profile, "company") ? profile.company : null,
    job_title: fieldIsShared(profile, "job_title") ? profile.job_title : null,
    addresses: [],
    notes: noteLines.length ? noteLines.join("\n\n") : null,
  };
}
