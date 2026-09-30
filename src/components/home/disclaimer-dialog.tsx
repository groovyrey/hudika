"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function DisclaimerDialog() {
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    // The dialog is hidden on the server and during the first client render so
    // the HTML always hydrates the same. After mount it opens on every load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={dismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="relative w-full max-w-[30rem] animate-in fade-in zoom-in-95 duration-150 rounded-2xl border border-border bg-background p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Info className="size-4" />
          </span>
          <h2 id="disclaimer-title" className="pt-1 font-serif text-xl leading-snug tracking-[-0.01em]">
            Hudika is an AI research assistant, not your lawyer.
          </h2>
        </div>

        <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Hudika answers from Philippine statutes, Supreme Court decisions, and the Constitution it
            can actually retrieve, and says so plainly when it cannot verify something. That check
            still misses nuance.
          </p>
          <p>
            Anything it says is general legal information, not legal advice. A Philippine licensed
            attorney should review the specifics of your situation before you act on it.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/about"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "h-8 border-input px-3 text-[0.8125rem] font-normal",
            })}
          >
            About Hudika &amp; sources
          </Link>
          <Button size="sm" className="h-8 px-3 text-[0.8125rem]" onClick={dismiss}>
            I understand
          </Button>
        </div>
      </div>
    </div>
  );
}