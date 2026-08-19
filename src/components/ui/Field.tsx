import type { ContactFieldSpec } from "@/lib/contacts/schema";

const CONTROL =
  "w-full rounded-md border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:bg-input";

/**
 * One labelled form control, driven by the field metadata in
 * `lib/contacts/schema.ts` so the form and its validation cannot drift apart.
 */
export default function Field({
  field,
  defaultValue,
  error,
}: {
  field: ContactFieldSpec;
  defaultValue?: string;
  error?: string;
}) {
  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const borderClass = error
    ? "border-destructive focus:border-destructive"
    : "border-border focus:border-primary";

  const shared = {
    id,
    name: field.name,
    defaultValue,
    maxLength: field.maxLength,
    required: field.required,
    placeholder: field.placeholder,
    autoComplete: field.autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: `${CONTROL} ${borderClass}`,
  };

  return (
    <div className={field.wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {field.label}
        {field.required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>

      {field.type === "textarea" ? (
        <textarea {...shared} rows={4} className={`${shared.className} resize-y`} />
      ) : (
        <input {...shared} type={field.type ?? "text"} />
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
