"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import {
  apiErrorMessage,
  createContact,
  toFieldErrors,
} from "@/lib/contacts/api";
import {
  contactInputSchema,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { Contact, FormState } from "@/lib/contacts/types";
import {
  NEARBY_SHARE_FIELDS,
  nearbyProfileToContactInput,
  qualifiesForEncounter,
  type NearbyShareField,
  type NearbySharedProfile,
} from "@/lib/nearby/simulation";

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";
const SHARE_FIELD_KEYS = new Set(NEARBY_SHARE_FIELDS.map((field) => field.key));

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function nullableValue(formData: FormData, name: string): string | null {
  return stringValue(formData, name) || null;
}

function sharedFieldsFromFormData(formData: FormData): NearbyShareField[] {
  return formData
    .getAll("shared_field")
    .map(String)
    .filter((value): value is NearbyShareField =>
      SHARE_FIELD_KEYS.has(value as NearbyShareField),
    );
}

function numericValue(formData: FormData, name: string): number {
  return Number(stringValue(formData, name));
}

function formHasQualifiedEncounter(formData: FormData): boolean {
  const closeForMs = numericValue(formData, "close_for_ms");
  const distanceMeters = numericValue(formData, "distance_meters");

  return (
    Number.isFinite(closeForMs) &&
    Number.isFinite(distanceMeters) &&
    qualifiesForEncounter({ closeForMs, distanceMeters })
  );
}

function profileFromFormData(formData: FormData): NearbySharedProfile {
  const firstName = stringValue(formData, "first_name");
  const lastName = stringValue(formData, "last_name");

  return {
    peerKey: stringValue(formData, "peer_key"),
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    email: stringValue(formData, "email"),
    phone: nullableValue(formData, "phone"),
    photo: nullableValue(formData, "photo"),
    company: nullableValue(formData, "company"),
    job_title: nullableValue(formData, "job_title"),
    website: nullableValue(formData, "website"),
    sharedFields: sharedFieldsFromFormData(formData),
  };
}

export async function saveNearbyEncounterAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!formHasQualifiedEncounter(formData)) {
    return {
      status: "error",
      message: "This encounter has not qualified yet.",
    };
  }

  const profile = profileFromFormData(formData);
  const input = nearbyProfileToContactInput(
    profile,
    stringValue(formData, "private_note"),
  );
  const parsed = contactInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "This shared card is missing required contact details.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  let saved: Contact;
  try {
    saved = await createContact(parsed.data);
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      return { status: "error", message: UNREACHABLE };
    }
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          status: "error",
          message: "That nearby contact is already in your address book.",
          fieldErrors: {
            email: apiErrorMessage(error, "This email is already in use."),
          },
        };
      }
      if (error.status === 422) {
        return {
          status: "error",
          message: "The API rejected this shared card.",
          fieldErrors: toFieldErrors(error),
        };
      }
      return {
        status: "error",
        message: apiErrorMessage(error, "The nearby contact could not be saved."),
      };
    }
    throw error;
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${saved.id}`);
  redirect(`/contacts/${saved.id}`);
}
