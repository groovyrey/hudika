"use client";

import { useEffect } from "react";
import { ExternalLink, Gavel, Globe, Landmark, ScrollText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/citations";

const KIND_ICON = {
  case: Gavel,
  statute: ScrollText,
  constitution: Landmark,
  source: Globe,
} as const;

export function CitationsModal(props: {
  citations: Citation[];
  onClose: () => void;
  onOpenSource: (citation: Citation) => void;
}) {
  const { citations, onClose, onOpenSource } = props;

  useEffect(() => {
    if (citations.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [citations.length, onClose]);

  if (citations.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="citations-title"
        className="relative flex max-h-[85vh] w-full max-w-[34rem] animate-in fade-in zoom-in-95 duration-150 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 id="citations-title" className="font-serif text-lg leading-snug tracking-[-0.01em]">
              Cited sources
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Retrieved to ground this answer.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close sources">
            <X className="size-4" />
          </Button>
        </header>

        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {citations.map((citation, i) => {
            const Icon = KIND_ICON[citation.kind];
            return (
              <li key={`${citation.kind}-${i}-${citation.url ?? citation.label}`} className="flex items-start gap-3 px-6 py-4">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/70 text-muted-foreground dark:bg-muted/70">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">
                    {citation.label}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">
                    {citation.title}
                  </span>
                  {citation.url && (
                    <span className="mt-1 block truncate font-mono text-[0.6875rem] text-muted-foreground/80">
                      {citation.url}
                    </span>
                  )}
                </span>
                {citation.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 shrink-0 p-0"
                    onClick={() => onOpenSource(citation)}
                    title="Open source"
                    aria-label={`Open ${citation.label}`}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}