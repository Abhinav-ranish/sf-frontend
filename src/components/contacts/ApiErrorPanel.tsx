import { ServerCrash } from "lucide-react";

/** Inline failure panel — keeps the page chrome instead of blanking the route. */
export default function ApiErrorPanel({
  title = "Could not load contacts",
  message,
  hint,
}: {
  title?: string;
  message: string;
  hint?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
    >
      <ServerCrash
        className="mx-auto h-8 w-8 text-destructive"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h2 className="mt-4 font-display text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {message}
      </p>
      {hint ? (
        <p className="mx-auto mt-3 max-w-md font-mono text-[12px] text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
