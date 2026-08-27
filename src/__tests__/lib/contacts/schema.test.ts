import {
  CONTACT_ADDRESS_FIELDS,
  CONTACT_FIELDS,
  MAX_PHOTO_BYTES,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

const PHOTO = "data:image/png;base64,YXZhdGFy";

function values(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    photo: "",
    company: "",
    job_title: "",
    notes: "",
    addresses: [],
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      {
        ...values({ first_name: "a".repeat(101) }),
        addresses: [{ type: "Home", postal_code: "9".repeat(21) }],
      },
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      addresses: "Postal code must be 20 characters or fewer",
    });
  });

  it("accepts supported photo data URLs", () => {
    expect(contactInputSchema.parse(values({ photo: PHOTO })).photo).toBe(PHOTO);
  });

  it("rejects unsupported and oversized photos", () => {
    let result = contactInputSchema.safeParse(values({ photo: "data:image/gif;base64,AAAA" }));
    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be a JPEG, PNG, or WebP image.",
    );

    const encoded = "a".repeat(Math.ceil((MAX_PHOTO_BYTES + 1) / 3) * 4);
    result = contactInputSchema.safeParse(values({ photo: `data:image/jpeg;base64,${encoded}` }));
    expect(zodFieldErrors(result.error!).photo).toBe("Photo must be 512 KB or smaller.");
  });

  it("requires address rows to have at least one postal field", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      addresses: [{ type: "Other" }],
    });

    expect(zodFieldErrors(result.error!).addresses).toBe(
      "Address must include at least one postal field.",
    );
  });

  it("rejects unknown address types", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      addresses: [{ type: "Office", city: "San Francisco" }],
    });

    expect(zodFieldErrors(result.error!).addresses).toBe(
      'Invalid option: expected one of "Home"|"Work"|"Other"',
    );
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "addresses", "photo"].sort(),
    );
  });

  it("pulls address rows in order and drops empty rows", () => {
    const formData = new FormData();
    formData.set("addresses.1.type", "Work");
    formData.set("addresses.1.city", "San Francisco");
    formData.set("addresses.0.type", "Home");
    formData.set("addresses.0.address", "");

    const extracted = formDataToValues(formData);

    expect(extracted.addresses).toEqual([
      {
        type: "Work",
        address: "",
        city: "San Francisco",
        state: "",
        postal_code: "",
        country: "",
      },
    ]);
    expect(CONTACT_ADDRESS_FIELDS.map((field) => field.name)).toContain("postal_code");
  });
});
