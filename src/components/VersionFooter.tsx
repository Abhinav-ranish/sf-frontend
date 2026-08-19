"use client";

const webVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const webBuildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "dev";
const webGitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown";

export default function VersionFooter() {
  return (
    <footer className="border-t border-hairline bg-card">
      <div className="mx-auto max-w-5xl px-4 py-3 text-center text-[11px] leading-snug text-muted-foreground">
        <span className="font-mono">
          web v{webVersion} (build {webBuildNumber} · {webGitSha})
        </span>
      </div>
    </footer>
  );
}
