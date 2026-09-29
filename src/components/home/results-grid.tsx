"use client";

import { ExternalLink, Globe } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SearchResult } from "./types";

function safeHostname(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function ResultsGrid(props: {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  const { results, onSelect } = props;

  return (
    <div className="grid grid-cols-1 gap-3">
      {results.map((res, i) => {
        const hostname = safeHostname(res.url);
        return (
          <Card
            key={`${res.url}-${i}`}
            className="hover:border-primary/50 transition-colors shadow-none flex flex-col h-full cursor-pointer group relative pt-4"
            onClick={() => onSelect(res)}
          >
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
              SOURCE {i + 1}
            </div>
            <CardHeader className="p-4 pb-2">
              <div className="font-bold text-sm leading-tight group-hover:text-primary flex items-start justify-between gap-2">
                <span className="flex-1 line-clamp-2">{res.name}</span>
                {res.url ? (
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-1.5 py-1 hover:bg-muted rounded-md transition-colors flex items-center border border-transparent hover:border-border shrink-0"
                    title="Open in new tab"
                  >
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{res.snippet}</p>
              {hostname && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium border-t pt-2 mt-auto">
                  <Globe className="size-2.5 shrink-0" />
                  <span className="truncate">{hostname}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
