"use client";

import {
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Check,
  Clock,
  Eye,
  Radio,
  Save,
  Share2,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import Button, { buttonClasses } from "@/components/ui/Button";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/contacts/types";
import {
  DEFAULT_NEARBY_SHARE_FIELDS,
  NEARBY_QUALIFY_AFTER_MS,
  NEARBY_SHARE_FIELDS,
  NEARBY_SIMULATION_SPEED,
  SIMULATED_NEARBY_PROFILE,
  contactToOutgoingShare,
  createEphemeralSeed,
  fieldIsShared,
  normalizeWebsiteUrl,
  qualifiesForEncounter,
  resolveSimulatedEncounter,
  rotatingEphemeralId,
  simulatedSignal,
  type NearbyShareField,
  type NearbyShareSourceContact,
  type NearbySharedProfile,
} from "@/lib/nearby/simulation";

export type NearbySaveAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

export interface NearbyDiscoveryState {
  status: "idle" | "error";
  message?: string;
  encounterToken?: string;
  startedAtMs?: number;
}

export type NearbyStartAction = () => Promise<NearbyDiscoveryState>;

export type NearbyLoadContactAction = (
  contactId: number,
) => Promise<NearbyShareSourceContact | null>;

const SWITCH_BASE =
  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors";
const SWITCH_KNOB =
  "inline-block size-5 rounded-full bg-foreground transition-transform";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatEncounterTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function SaveEncounterButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" strokeWidth={1.75} aria-hidden="true" />
      {pending ? "Saving..." : "Save Contact"}
    </Button>
  );
}

function SwitchCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  icon: typeof Share2;
}) {
  const id = `nearby-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
    >
      <span className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground">
            {title}
          </span>
          <span className="mt-0.5 block text-pretty text-[13px] text-muted-foreground">
            {description}
          </span>
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`${SWITCH_BASE} ${
          checked ? "border-primary bg-primary" : "border-border bg-secondary"
        }`}
      >
        <span
          className={`${SWITCH_KNOB} ${
            checked ? "translate-x-5 bg-primary-foreground" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

function ProfileRows({ profile }: { profile: NearbySharedProfile }) {
  const rows: { label: string; value: ReactNode }[] = [];
  const website = fieldIsShared(profile, "website")
    ? normalizeWebsiteUrl(profile.website)
    : null;

  if (fieldIsShared(profile, "email") && profile.email) {
    rows.push({
      label: "Email",
      value: (
        <a href={`mailto:${profile.email}`} className="text-primary hover:underline">
          {profile.email}
        </a>
      ),
    });
  }

  if (fieldIsShared(profile, "phone") && profile.phone) {
    rows.push({
      label: "Phone",
      value: (
        <a href={`tel:${profile.phone}`} className="text-primary hover:underline">
          {profile.phone}
        </a>
      ),
    });
  }

  if (fieldIsShared(profile, "company") && profile.company) {
    rows.push({ label: "Company", value: profile.company });
  }

  if (fieldIsShared(profile, "job_title") && profile.job_title) {
    rows.push({ label: "Job title", value: profile.job_title });
  }

  if (website) {
    rows.push({
      label: "Website",
      value: (
        <a href={website} className="text-primary hover:underline">
          {website}
        </a>
      ),
    });
  }

  if (!rows.length) {
    return (
      <p className="text-pretty text-sm text-muted-foreground">
        Only the selected identity fields are visible on this card.
      </p>
    );
  }

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
          <dd className="break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SharedProfileCard({
  profile,
  eyebrow,
}: {
  profile: NearbySharedProfile;
  eyebrow: string;
}) {
  const visibleName = fieldIsShared(profile, "name")
    ? profile.full_name
    : "Nearby Contact";
  const visiblePhoto = fieldIsShared(profile, "photo") ? profile.photo : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[12px] font-medium uppercase text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <ContactAvatar
          contact={{
            first_name: visibleName.split(" ")[0] ?? "",
            last_name: visibleName.split(" ").slice(1).join(" "),
            email: profile.email || `${profile.peerKey}@nearby.local`,
            photo: visiblePhoto,
          }}
          size="lg"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-balance font-display text-lg font-semibold text-foreground">
              {visibleName}
            </h3>
            {fieldIsShared(profile, "job_title") && profile.job_title ? (
              <p className="text-pretty text-sm text-muted-foreground">
                {profile.job_title}
                {fieldIsShared(profile, "company") && profile.company
                  ? ` at ${profile.company}`
                  : ""}
              </p>
            ) : null}
          </div>
          <ProfileRows profile={profile} />
        </div>
      </div>
    </div>
  );
}

function ShareFieldPicker({
  selected,
  onToggle,
}: {
  selected: NearbyShareField[];
  onToggle: (field: NearbyShareField) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">
        Shareable fields
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {NEARBY_SHARE_FIELDS.map((field) => {
          const checked = selected.includes(field.key);
          return (
            <label
              key={field.key}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
                checked
                  ? "border-primary/70 bg-primary/10 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-secondary/40"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(field.key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-4 items-center justify-center rounded border ${
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {checked ? <Check className="size-3" strokeWidth={2} /> : null}
              </span>
              {field.label}
            </label>
          );
        })}
      </div>
      <p className="text-pretty text-[13px] text-muted-foreground">
        Private notes are not available as a shared field.
      </p>
    </fieldset>
  );
}

function EncounterForm({
  encounterToken,
  state,
  action,
  onDismiss,
}: {
  encounterToken: string;
  state: FormState;
  action: (formData: FormData) => void;
  onDismiss: () => void;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="encounter_token" value={encounterToken} />

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="nearby-private-note"
          className="mb-1.5 block text-[13px] font-medium text-foreground"
        >
          Private note
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        </label>
        <textarea
          id="nearby-private-note"
          name="private_note"
          rows={3}
          placeholder="Where you met or what to follow up on."
          className="w-full resize-y rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SaveEncounterButton />
        <Button type="button" variant="ghost" onClick={onDismiss}>
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Dismiss
        </Button>
      </div>
    </form>
  );
}

export default function NearbyContactSharing({
  contacts,
  totalContacts,
  loadContactAction,
  startAction,
  action,
}: {
  contacts: NearbyShareSourceContact[];
  totalContacts: number;
  loadContactAction: NearbyLoadContactAction;
  startAction: NearbyStartAction;
  action: NearbySaveAction;
}) {
  const [shareEnabled, setShareEnabled] = useState(false);
  const [discoverEnabled, setDiscoverEnabled] = useState(false);
  const discoveryRequestId = useRef(0);
  const [discoveryIsStarting, setDiscoveryIsStarting] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [encounterToken, setEncounterToken] = useState<string | null>(null);
  const [shareSeed] = useState(() => createEphemeralSeed());
  const [discoverSeed] = useState(() => createEphemeralSeed());
  const [selectedContactId, setSelectedContactId] = useState(
    contacts[0]?.id ?? 0,
  );
  const [selectedContactDetail, setSelectedContactDetail] =
    useState<NearbyShareSourceContact | null>(null);
  const [selectedContactLoadError, setSelectedContactLoadError] =
    useState<{ contactId: number; message: string } | null>(null);
  const [selectedFields, setSelectedFields] = useState<NearbyShareField[]>(
    DEFAULT_NEARBY_SHARE_FIELDS,
  );
  const [website, setWebsite] = useState("");
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0];
  const selectedContactHasPhotoField = selectedContact
    ? "photo" in selectedContact
    : false;
  const shareSourceContact =
    selectedContactDetail?.id === selectedContact?.id
      ? selectedContactDetail
      : selectedContact;
  const selectedContactIdForLoad = selectedContact?.id;
  const selectedContactLoadMessage =
    selectedContactLoadError &&
    selectedContactLoadError.contactId === selectedContactIdForLoad
      ? selectedContactLoadError.message
      : null;

  const outgoingProfile = useMemo(
    () =>
      shareSourceContact
        ? contactToOutgoingShare(
            shareSourceContact,
            selectedFields,
            website,
            shareSeed,
          )
        : null,
    [shareSeed, shareSourceContact, selectedFields, website],
  );

  useEffect(() => {
    if (!selectedContactIdForLoad || selectedContactHasPhotoField) return;

    let active = true;

    loadContactAction(selectedContactIdForLoad)
      .then((contact) => {
        if (active && contact?.id === selectedContactIdForLoad) {
          setSelectedContactDetail(contact);
          setSelectedContactLoadError(null);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedContactLoadError({
            contactId: selectedContactIdForLoad,
            message: "Full card details are unavailable right now.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [loadContactAction, selectedContactHasPhotoField, selectedContactIdForLoad]);

  useEffect(() => {
    if (!shareEnabled && !discoverEnabled) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [shareEnabled, discoverEnabled]);

  const signal = discoverEnabled && encounterToken && startedAtMs
    ? simulatedSignal({
        peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
        rotationSeed: discoverSeed,
        startedAtMs,
        nowMs,
      })
    : null;

  const encounter = useMemo(() => {
    if (!signal || !startedAtMs || !qualifiesForEncounter(signal)) return null;

    const qualifiedAtMs =
      startedAtMs + Math.ceil(NEARBY_QUALIFY_AFTER_MS / NEARBY_SIMULATION_SPEED);
    return resolveSimulatedEncounter(
      simulatedSignal({
        peerKey: SIMULATED_NEARBY_PROFILE.peerKey,
        rotationSeed: discoverSeed,
        startedAtMs,
        nowMs: qualifiedAtMs,
      }),
    );
  }, [discoverSeed, signal, startedAtMs]);

  function toggleShareField(field: NearbyShareField) {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  }

  function dismissEncounter() {
    setDiscoverEnabled(false);
    setStartedAtMs(null);
    setNowMs(Date.now());
  }

  async function updateDiscovery(checked: boolean) {
    const requestId = discoveryRequestId.current + 1;
    discoveryRequestId.current = requestId;
    setDiscoveryError(null);

    if (!checked) {
      setDiscoverEnabled(false);
      setDiscoveryIsStarting(false);
      setStartedAtMs(null);
      setEncounterToken(null);
      setNowMs(Date.now());
      return;
    }

    setDiscoverEnabled(true);
    setDiscoveryIsStarting(true);
    setStartedAtMs(null);
    setEncounterToken(null);

    try {
      const result = await startAction();
      if (discoveryRequestId.current !== requestId) return;

      if (result.status === "error" || !result.encounterToken) {
        setDiscoverEnabled(false);
        setDiscoveryError(result.message ?? "Could not start discovery.");
        return;
      }

      const started = result.startedAtMs ?? Date.now();
      setEncounterToken(result.encounterToken);
      setStartedAtMs(started);
      setNowMs(started);
    } catch {
      if (discoveryRequestId.current !== requestId) return;

      setDiscoverEnabled(false);
      setDiscoveryError("Could not start discovery.");
    } finally {
      if (discoveryRequestId.current === requestId) {
        setDiscoveryIsStarting(false);
      }
    }
  }

  const progress = signal
    ? Math.min(signal.closeForMs / NEARBY_QUALIFY_AFTER_MS, 1)
    : 0;
  const outgoingId =
    outgoingProfile && shareEnabled
      ? rotatingEphemeralId(shareSeed, nowMs)
      : null;
  const hasIncompleteContactList = totalContacts > contacts.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-2">
        <SwitchCard
          checked={shareEnabled}
          onChange={setShareEnabled}
          title="Share my contact"
          description="Advertise only the curated card below."
          icon={Share2}
        />
        <SwitchCard
          checked={discoverEnabled}
          onChange={updateDiscovery}
          title="Discover nearby people"
          description="Qualify an encounter after sustained close proximity."
          icon={Eye}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <Shield className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-balance font-display text-lg font-semibold text-foreground">
                Outgoing share card
              </h2>
              <p className="text-pretty text-[13px] text-muted-foreground">
                Ephemeral IDs rotate separately from the selected contact fields.
              </p>
            </div>
          </div>

          {contacts.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nearby-contact-source"
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    Contact card
                  </label>
                  <select
                    id="nearby-contact-source"
                    value={selectedContact?.id ?? 0}
                    onChange={(event) =>
                      setSelectedContactId(Number(event.currentTarget.value))
                    }
                    className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary"
                  >
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.full_name}
                      </option>
                    ))}
                  </select>
                  {hasIncompleteContactList ? (
                    <p className="mt-1.5 text-[12px] text-muted-foreground" role="status">
                      Showing {contacts.length} of {totalContacts} contacts.
                    </p>
                  ) : null}
                  {selectedContactLoadMessage ? (
                    <p className="mt-1.5 text-[12px] text-muted-foreground" role="status">
                      {selectedContactLoadMessage}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="nearby-website"
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    Website
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      optional
                    </span>
                  </label>
                  <input
                    id="nearby-website"
                    value={website}
                    onChange={(event) => setWebsite(event.currentTarget.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input"
                  />
                </div>
              </div>

              <ShareFieldPicker
                selected={selectedFields}
                onToggle={toggleShareField}
              />
            </>
          ) : (
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <p className="text-pretty text-sm text-muted-foreground">
                Add a contact before enabling your outgoing share card.
              </p>
              <Link
                href="/contacts/new"
                className={buttonClasses("secondary", "sm", "mt-3")}
              >
                <UserPlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                New contact
              </Link>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          {outgoingProfile ? (
            <SharedProfileCard
              profile={outgoingProfile}
              eyebrow={shareEnabled ? "Sharing" : "Paused"}
            />
          ) : null}
          <div className="rounded-lg border border-border bg-card/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Current ID</span>
              <span className="font-mono text-[12px] text-foreground">
                {outgoingId ?? "not sharing"}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <Radio className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-balance font-display text-lg font-semibold text-foreground">
              Encounter detector
            </h2>
            <p className="text-pretty text-[13px] text-muted-foreground">
              Personal details appear only after a sustained close signal qualifies.
            </p>
          </div>
        </div>

        {encounter && encounterToken ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-4">
              <div className="rounded-lg border border-success/40 bg-success/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-balance font-display text-lg font-semibold text-foreground">
                      You may have met{" "}
                      {fieldIsShared(encounter.profile, "name")
                        ? encounter.profile.full_name
                        : "someone nearby"}{" "}
                      at{" "}
                      {formatEncounterTime(encounter.metAt)}
                    </h2>
                    <p className="mt-1 text-pretty text-sm text-muted-foreground">
                      Qualified after {formatDuration(encounter.signal.closeForMs)} close by.
                    </p>
                  </div>
                </div>
              </div>
              <SharedProfileCard profile={encounter.profile} eyebrow="Curated card" />
            </div>
            <EncounterForm
              encounterToken={encounterToken}
              state={state}
              action={formAction}
              onDismiss={dismissEncounter}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card/50 p-4">
            {discoveryError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
              >
                {discoveryError}
              </p>
            ) : discoveryIsStarting ? (
              <p className="text-pretty text-sm text-muted-foreground" role="status">
                Starting discovery...
              </p>
            ) : discoverEnabled && signal ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">Nearby signal</p>
                    <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                      {signal.ephemeralId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {signal.distanceMeters.toFixed(1)} m
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      very close
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      Close for {formatDuration(signal.closeForMs)}
                    </span>
                    <span>{formatDuration(NEARBY_QUALIFY_AFTER_MS)}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Encounter qualification progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    className="h-2 overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className="h-full origin-left rounded-full bg-primary"
                      style={{ transform: `scaleX(${progress})` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-pretty text-sm text-muted-foreground">
                Discovery is off. You can still configure your share card above.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
