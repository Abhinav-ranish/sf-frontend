import { z } from "zod";
import type {
  AddressType,
  ContactAddressFormValues,
  ContactInput,
  ContactFormValues,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const satisfies readonly AddressType[];
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 512 * 1024;
export const MAX_PHOTO_LABEL = "512 KB";

const PHOTO_DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

function decodedBase64Bytes(encoded: string): number {
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return (encoded.length / 4) * 3 - padding;
}

const photoSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value) return;

    const match = PHOTO_DATA_URL_RE.exec(value);
    if (!match) {
      ctx.addIssue({
        code: "custom",
        message: "Photo must be a JPEG, PNG, or WebP image.",
      });
      return;
    }

    if (decodedBase64Bytes(match[2]) > MAX_PHOTO_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: `Photo must be ${MAX_PHOTO_LABEL} or smaller.`,
      });
    }
  })
  .transform((value) => value || null)
  .nullable()
  .default(null);

export const contactAddressInputSchema = z
  .object({
    type: z.enum(ADDRESS_TYPES).default("Home"),
    address: optionalText(300, "Street address"),
    city: optionalText(120, "City"),
    state: optionalText(120, "State / region"),
    postal_code: optionalText(20, "Postal code"),
    country: optionalText(120, "Country"),
  })
  .refine(
    (address) =>
      Boolean(
        address.address ||
          address.city ||
          address.state ||
          address.postal_code ||
          address.country,
      ),
    {
      message: "Address must include at least one postal field.",
      path: ["address"],
    },
  );

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  photo: photoSchema,
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z
    .array(contactAddressInputSchema)
    .max(10, "You can save up to 10 addresses per contact")
    .default([]),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: keyof ContactInput;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

export interface ContactAddressFieldSpec {
  name: Exclude<keyof ContactAddressFormValues, "type">;
  label: string;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  wide?: boolean;
}

export const CONTACT_ADDRESS_FIELDS: ContactAddressFieldSpec[] = [
  {
    name: "address",
    label: "Street address",
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    autoComplete: "street-address",
    wide: true,
  },
  {
    name: "city",
    label: "City",
    maxLength: 120,
    placeholder: "San Francisco",
    autoComplete: "address-level2",
  },
  {
    name: "state",
    label: "State / region",
    maxLength: 120,
    placeholder: "CA",
    autoComplete: "address-level1",
  },
  {
    name: "postal_code",
    label: "Postal code",
    maxLength: 20,
    placeholder: "94105",
    autoComplete: "postal-code",
  },
  {
    name: "country",
    label: "Country",
    maxLength: 120,
    placeholder: "USA",
    autoComplete: "country-name",
  },
];

export const EMPTY_ADDRESS_FORM_VALUE: ContactAddressFormValues = {
  type: "Home",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

function addressHasDetails(address: ContactAddressFormValues): boolean {
  return CONTACT_ADDRESS_FIELDS.some((field) => address[field.name].trim());
}

/** Pull the contact fields out of a submitted form, as raw strings. */
export function formDataToValues(formData: FormData): ContactFormValues {
  const values = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Omit<ContactFormValues, "addresses" | "photo">;

  const addressesByIndex = new Map<number, ContactAddressFormValues>();
  const addressPattern = /^addresses\.(\d+)\.(type|address|city|state|postal_code|country)$/;

  for (const [key, rawValue] of formData.entries()) {
    const match = addressPattern.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2] as keyof ContactAddressFormValues;
    const address = addressesByIndex.get(index) ?? { ...EMPTY_ADDRESS_FORM_VALUE };
    if (field === "type") {
      address.type = String(rawValue) as AddressType;
    } else {
      address[field] = String(rawValue);
    }
    addressesByIndex.set(index, address);
  }

  const addresses = [...addressesByIndex.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, address]) => address)
    .filter(addressHasDetails);

  return {
    ...values,
    photo: String(formData.get("photo") ?? ""),
    addresses,
  };
}
