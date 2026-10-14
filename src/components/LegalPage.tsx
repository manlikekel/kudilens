import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Shared layout for the public Privacy and Terms pages (no sign-in needed). */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh px-safe pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <img src="/icons/icon.svg" alt="" className="size-8 rounded-[10px]" />
          <span className="font-display text-[17px] font-semibold tracking-tight">
            Kudi<span className="text-primary">Lens</span>
          </span>
        </Link>
        <article className="panel mt-6 p-6 sm:p-10">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
          <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
