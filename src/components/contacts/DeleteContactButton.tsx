"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteContactAction } from "@/app/contacts/actions";
import Button, { type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * Two-step delete: the first click swaps the button for an explicit
 * confirm/cancel pair, so there is no way to lose a contact to a stray click
 * and no `window.confirm` to trip up tests or screen readers.
 */
export default function DeleteContactButton({
  contactId,
  contactName,
  redirectToList = false,
  variant = "ghost",
  size = "sm",
  withLabel = false,
}: {
  contactId: number;
  contactName: string;
  redirectToList?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  withLabel?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteContactAction(contactId, redirectToList);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button
          variant={variant}
          size={size}
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${contactName}`}
          className={variant === "ghost" ? "hover:text-destructive" : undefined}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {withLabel ? "Delete" : null}
        </Button>
        {error ? (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[13px] text-muted-foreground">Delete?</span>
      <Button
        variant="danger"
        size="sm"
        onClick={remove}
        disabled={isPending}
        aria-label={`Confirm deleting ${contactName}`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        Yes
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={isPending}
      >
        No
      </Button>
    </span>
  );
}
