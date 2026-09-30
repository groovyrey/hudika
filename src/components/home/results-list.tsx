"use client";

import { ExternalLink } from "lucide-react";
import type { SearchResult } from "./types";

function safeHostname(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function ResultsList(props: {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  const { results, onSelect } = props;

  return (
    <ol className="divide-y divide-border">
      {results.map((res, i) => {
        const hostname = safeHostname(res.url);
        return (
          <li key={`${res.url}-${i}`}>
            <div className="group relative py-5">
              <button
                type="button"
                onClick={() => onSelect(res)}
                className="block w-full pr-8 text-left"
              >
                <span className="font-serif text-[0.9375rem] leading-snug tracking-[-0.005em] decoration-1 underline-offset-4 group-hover:underline">
                  {res.name}
                </span>
                {res.snippet && (
                  <p className="mt-2 line-clamp-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {res.snippet}
                  </p>
                )}
                {hostname && (
                  <span className="mt-2.5 block truncate font-mono text-[0.6875rem] text-muted-foreground/80">
                    {hostname}
                  </span>
                )}
              </button>
              {res.url ? (
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open in new tab"
                  aria-label={`Open ${res.name} in a new tab`}
                  className="absolute right-0 top-5 p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
