import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  loadNearbyShareContactAction,
  saveNearbyEncounterAction,
  startNearbyDiscoveryAction,
} from "@/app/contacts/nearby/actions";
import ApiErrorPanel from "@/components/contacts/ApiErrorPanel";
import NearbyContactSharing from "@/components/contacts/NearbyContactSharing";
import { ApiUnreachableError, apiBaseUrl } from "@/lib/apiClient";
import { listContacts } from "@/lib/contacts/api";
import { MAX_LIMIT, type ContactPage } from "@/lib/contacts/types";

export const metadata: Metadata = {
  title: "Nearby sharing",
  description: "Demo contact exchange after sustained nearby proximity.",
};

async function listAllContacts(): Promise<ContactPage> {
  const firstPage = await listContacts({ limit: MAX_LIMIT });
  const items = [...firstPage.items];

  while (items.length < firstPage.total) {
    const page = await listContacts({
      limit: MAX_LIMIT,
      offset: items.length,
    });
    if (!page.items.length) break;
    items.push(...page.items);
  }

  return {
    ...firstPage,
    items,
    limit: items.length,
    offset: 0,
  };
}

export default async function NearbyContactSharingPage() {
  const outcome = await listAllContacts().catch(
    (error: unknown) => error as Error,
  );
  const result: ContactPage | null = outcome instanceof Error ? null : outcome;
  const error: Error | null = outcome instanceof Error ? outcome : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          All contacts
        </Link>
        <h1 className="mt-2 text-balance font-display text-2xl font-bold text-foreground">
          Nearby sharing
        </h1>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          Simulated close-range contact exchange for the current web app.
        </p>
      </div>

      {error ? (
        <ApiErrorPanel
          message={
            error instanceof ApiUnreachableError
              ? "The Contacts API did not respond. Start the backend and reload."
              : error.message
          }
          hint={`API base URL: ${apiBaseUrl || "(same origin)"}`}
        />
      ) : (
        <NearbyContactSharing
          contacts={result?.items ?? []}
          totalContacts={result?.total ?? 0}
          loadContactAction={loadNearbyShareContactAction}
          startAction={startNearbyDiscoveryAction}
          action={saveNearbyEncounterAction}
        />
      )}
    </div>
  );
}
