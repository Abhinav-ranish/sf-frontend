"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import Button from "@/components/ui/Button";

/** Route-level error boundary for anything the pages did not handle themselves. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-[12px] text-muted-foreground/70">
          digest {error.digest}
        </p>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>
          <RotateCw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
