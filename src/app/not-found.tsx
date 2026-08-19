import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-[13px] text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
        Not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That page — or that contact — does not exist.
      </p>

      <div className="mt-6 flex justify-center">
        <Link href="/contacts" className={buttonClasses("primary")}>
          Back to contacts
        </Link>
      </div>
    </div>
  );
}
