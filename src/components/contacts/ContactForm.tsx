"use client";

import {
  Fragment,
  type ChangeEvent,
  useActionState,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import Field from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import {
  ADDRESS_TYPES,
  CONTACT_ADDRESS_FIELDS,
  CONTACT_FIELD_GROUPS,
  EMPTY_ADDRESS_FORM_VALUE,
  MAX_PHOTO_LABEL,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
} from "@/lib/contacts/schema";
import ContactAvatar from "./ContactAvatar";
import {
  EMPTY_FORM_STATE,
  type Contact,
  type ContactAddressFormValues,
  type ContactFormValues,
  type FormState,
} from "@/lib/contacts/types";

export type ContactFormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {pending ? "Saving…" : label}
    </Button>
  );
}

function normalizeAddressRows(rows: ContactAddressFormValues[]): ContactAddressFormValues[] {
  return rows.length ? rows : [{ ...EMPTY_ADDRESS_FORM_VALUE }];
}

function contactAddressesToFormValues(contact?: Contact): ContactAddressFormValues[] {
  if (!contact?.addresses.length) return [{ ...EMPTY_ADDRESS_FORM_VALUE }];
  return contact.addresses.map((address) => ({
    type: address.type,
    address: address.address ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postal_code ?? "",
    country: address.country ?? "",
  }));
}

function PhotoField({
  value,
  contact,
  error,
  onReadingChange,
}: {
  value: string;
  contact?: Contact;
  error?: string;
  onReadingChange: (isReading: boolean) => void;
}) {
  const [photo, setPhoto] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [editedSinceServerError, setEditedSinceServerError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readSeq = useRef(0);

  function clearFileInput() {
    if (fileRef.current) fileRef.current.value = "";
  }

  function setPhotoError(message: string | null) {
    setLocalError(message);
  }

  function setPhotoReading(nextIsReading: boolean) {
    setIsReading(nextIsReading);
    onReadingChange(nextIsReading);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
      readSeq.current += 1;
      setPhotoReading(false);
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      clearFileInput();
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      readSeq.current += 1;
      setPhotoReading(false);
      setPhotoError(`Photo must be ${MAX_PHOTO_LABEL} or smaller.`);
      clearFileInput();
      return;
    }

    const seq = ++readSeq.current;
    const reader = new FileReader();
    reader.onerror = () => {
      if (seq !== readSeq.current) return;
      setPhotoReading(false);
      setPhotoError("Could not read that image.");
      clearFileInput();
    };
    reader.onload = () => {
      if (seq !== readSeq.current) return;
      if (typeof reader.result !== "string" || !reader.result) {
        setPhotoReading(false);
        setPhotoError("Could not read that image.");
        clearFileInput();
        return;
      }
      setPhoto(reader.result);
      setPhotoReading(false);
      setPhotoError(null);
      setEditedSinceServerError(true);
      clearFileInput();
    };
    setPhotoReading(true);
    setPhotoError(null);
    reader.readAsDataURL(file);
  }

  const previewContact = {
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "preview@example.com",
    photo,
  };
  const message = localError ?? (editedSinceServerError ? null : error);
  const descriptionId = message
    ? "field-photo-error"
    : isReading
      ? "field-photo-status"
      : undefined;

  return (
    <fieldset className="space-y-4" aria-busy={isReading}>
      <legend className="sr-only">Photo</legend>
      <div className="border-b border-hairline pb-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Photo
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Optional profile image for this contact.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <ContactAvatar contact={previewContact} size="lg" />
        <div className="min-w-[220px] flex-1 space-y-2">
          <input type="hidden" name="photo" value={photo} />
          <label
            htmlFor="field-photo-file"
            className="mb-1.5 block text-[13px] font-medium text-foreground"
          >
            Profile image
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              optional
            </span>
          </label>
          <input
            ref={fileRef}
            id="field-photo-file"
            name="photo_file"
            type="file"
            accept={PHOTO_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={isReading}
            aria-invalid={message ? true : undefined}
            aria-describedby={descriptionId}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/70"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              JPEG, PNG, or WebP up to {MAX_PHOTO_LABEL}
            </span>
            {photo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isReading}
                onClick={() => {
                  readSeq.current += 1;
                  setPhotoReading(false);
                  setPhoto("");
                  setPhotoError(null);
                  setEditedSinceServerError(true);
                  clearFileInput();
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          {message ? (
            <p id="field-photo-error" role="alert" className="text-[13px] text-destructive">
              {message}
            </p>
          ) : null}
          {isReading ? (
            <p id="field-photo-status" role="status" className="text-[13px] text-muted-foreground">
              Preparing image…
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}

function AddressesFieldset({
  initialRows,
  error,
}: {
  initialRows: ContactAddressFormValues[];
  error?: string;
}) {
  const [rows, setRows] = useState(() => normalizeAddressRows(initialRows));

  function updateRow(
    index: number,
    field: keyof ContactAddressFormValues,
    value: string,
  ) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? ({ ...row, [field]: value } as ContactAddressFormValues) : row,
      ),
    );
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return normalizeAddressRows(next);
    });
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Addresses</legend>
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            Addresses
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Add home, work, or other postal details.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setRows((current) => [...current, { ...EMPTY_ADDRESS_FORM_VALUE }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add address
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-md border border-border bg-card/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-[13px] font-medium text-foreground">
                <span className="sr-only">Address type</span>
                <select
                  name={`addresses.${index}.type`}
                  value={row.type}
                  onChange={(event) => updateRow(index, "type", event.currentTarget.value)}
                  className="h-8 rounded-md border border-border bg-input px-2 text-sm text-foreground focus:border-primary"
                >
                  {ADDRESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(index)}
                aria-label={`Remove address ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CONTACT_ADDRESS_FIELDS.map((field) => (
                <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
                  <label
                    htmlFor={`addresses-${index}-${field.name}`}
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    {field.label}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      optional
                    </span>
                  </label>
                  <input
                    id={`addresses-${index}-${field.name}`}
                    name={`addresses.${index}.${field.name}`}
                    value={row[field.name]}
                    maxLength={field.maxLength}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    onChange={(event) =>
                      updateRow(index, field.name, event.currentTarget.value)
                    }
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Create/edit form. The field list comes from `CONTACT_FIELD_GROUPS`, and the
 * action is a bound server action — so a submit is a plain POST that works
 * before hydration and reports errors through `useActionState`.
 */
export default function ContactForm({
  action,
  contact,
  submitLabel,
  cancelHref,
}: {
  action: ContactFormAction;
  contact?: Contact;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [photoIsReading, setPhotoIsReading] = useState(false);

  function valueFor(name: keyof ContactFormValues): string {
    const submitted = state.values?.[name];
    if (typeof submitted === "string") return submitted;

    const current = contact?.[name as keyof Contact];
    return typeof current === "string" ? current : "";
  }

  const photoValue = state.values?.photo ?? contact?.photo ?? "";
  const addressRows = state.values?.addresses
    ? normalizeAddressRows(state.values.addresses)
    : contactAddressesToFormValues(contact);
  const photoKey = `${contact?.id ?? "new"}-${photoValue.length}-${photoValue.slice(0, 32)}`;
  const addressRowsKey = `${contact?.id ?? "new"}-${JSON.stringify(addressRows)}`;

  return (
    <form action={formAction} noValidate className="space-y-8">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{state.message}</span>
        </div>
      ) : null}

      <PhotoField
        key={photoKey}
        value={photoValue}
        contact={contact}
        error={state.fieldErrors?.photo}
        onReadingChange={setPhotoIsReading}
      />

      {CONTACT_FIELD_GROUPS.map((group) => (
        <Fragment key={group.title}>
          <fieldset className="space-y-4">
            <legend className="sr-only">{group.title}</legend>

            <div className="border-b border-hairline pb-2">
              <h2 className="font-display text-sm font-semibold text-foreground">
                {group.title}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {group.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  defaultValue={valueFor(field.name)}
                  error={state.fieldErrors?.[field.name]}
                />
              ))}
            </div>
          </fieldset>

          {group.title === "Work" ? (
            <AddressesFieldset
              key={addressRowsKey}
              initialRows={addressRows}
              error={state.fieldErrors?.addresses}
            />
          ) : null}
        </Fragment>
      ))}

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <SubmitButton label={submitLabel} disabled={photoIsReading} />
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
