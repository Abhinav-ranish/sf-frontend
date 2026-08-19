import type { HealthResponse } from "@/lib/contacts/types";

/**
 * Renders `GET /health` so it is obvious at a glance whether the page is
 * showing live data or a stale/failed read.
 */
export default function ApiStatusBadge({
  health,
}: {
  health: HealthResponse | null;
}) {
  const ok = health?.status === "ok";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] text-muted-foreground"
      title={
        ok
          ? `API healthy · ${health?.database} · ${health?.contacts} stored`
          : "The Contacts API did not respond to its health check"
      }
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-destructive"}`}
      />
      <span className="font-mono">
        {ok ? `api ok · ${health?.database}` : "api unreachable"}
      </span>
    </span>
  );
}
