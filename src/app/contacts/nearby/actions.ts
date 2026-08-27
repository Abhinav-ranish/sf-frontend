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
import { nearbyProfileToContactInput } from "@/lib/nearby/simulation";
import { consumeNearbyEncounterToken } from "@/lib/nearby/tokens";

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function saveNearbyEncounterAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const tokenResult = consumeNearbyEncounterToken(
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
