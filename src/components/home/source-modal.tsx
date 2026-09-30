"use client";

import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "./types";

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function SourceModal(props: {
  result: SearchResult;
  onClose: () => void;
}) {
  const { result, onClose } = props;
  const canEmbed = isSafeHttpUrl(result.url);

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-background animate-in fade-in duration-150">
      <header className="flex items-start justify-between gap-6 border-b border-border px-6 py-5 sm:px-10">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="truncate font-serif text-lg leading-snug tracking-[-0.01em]">
            {result.name}
          </h2>
          <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">{result.url}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-input px-3 text-[0.8125rem] font-normal"
            onClick={() => window.open(result.url, "_blank")}
            disabled={!isSafeHttpUrl(result.url)}
          >
            <ExternalLink className="mr-2 size-3.5" />
            Open
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close source">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {canEmbed ? (
          <iframe
            src={result.url}
            className="h-full w-full border-none"
            title={result.name}
            // Keep the iframe sandboxed: embed is best-effort, user can always open the source in a new tab.
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-[36ch] text-sm text-muted-foreground">
              This page cannot be embedded. Open it in a new tab instead.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-input px-3 text-[0.8125rem] font-normal"
              onClick={() => window.open(result.url, "_blank")}
            >
              <ExternalLink className="mr-2 size-3.5" />
              Open
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
