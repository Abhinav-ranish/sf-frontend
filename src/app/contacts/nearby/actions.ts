"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import {
  apiErrorMessage,
  createContact,
  getContact,
  toFieldErrors,
} from "@/lib/contacts/api";
import {
  contactInputSchema,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { Contact, FormState } from "@/lib/contacts/types";
import { SIMULATED_NEARBY_PROFILE, nearbyProfileToContactInput } from "@/lib/nearby/simulation";
import {
  createNearbyEncounterToken,
  markNearbyEncounterTokenSaved,
  readNearbyEncounterToken,
  releaseNearbyEncounterToken,
  reserveNearbyEncounterToken,
} from "@/lib/nearby/tokens";
import type { NearbyShareSourceContact } from "@/lib/nearby/simulation";

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export interface NearbyDiscoveryState {
  status: "idle" | "error";
  message?: string;
  encounterToken?: string;
  startedAtMs?: number;
}

export async function startNearbyDiscoveryAction(): Promise<NearbyDiscoveryState> {
  const startedAtMs = Date.now();

  try {
    return {
      status: "idle",
      encounterToken: createNearbyEncounterToken(
        SIMULATED_NEARBY_PROFILE,
        startedAtMs,
      ),
      startedAtMs,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not start discovery.",
    };
  }
}

export async function loadNearbyShareContactAction(
  contactId: number,
): Promise<NearbyShareSourceContact | null> {
  if (!Number.isSafeInteger(contactId) || contactId <= 0) return null;

  const contact = await getContact(contactId);
  if (!contact) return null;

  return {
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    full_name: contact.full_name,
    email: contact.email,
    phone: contact.phone,
    photo: contact.photo,
    company: contact.company,
    job_title: contact.job_title,
  };
}

export async function saveNearbyEncounterAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const tokenResult = readNearbyEncounterToken(
    stringValue(formData, "encounter_token"),
  );
  if (!tokenResult.ok) {
    return {
      status: "error",
      message: tokenResult.message,
    };
  }

  const input = nearbyProfileToContactInput(
    tokenResult.payload.profile,
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

  const reservedToken = reserveNearbyEncounterToken(tokenResult.payload);
  if (!reservedToken.ok) {
    return {
      status: "error",
      message: reservedToken.message,
    };
  }

  let saved: Contact;
  try {
    saved = await createContact(parsed.data);
  } catch (error) {
    releaseNearbyEncounterToken(tokenResult.payload);

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

  markNearbyEncounterTokenSaved(tokenResult.payload);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${saved.id}`);
  redirect(`/contacts/${saved.id}`);
}
