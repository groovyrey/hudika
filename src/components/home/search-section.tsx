"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SearchEngineId } from "./types";
import { SEARCH_ENGINES } from "./search-engines";

export function SearchSection(props: {
  query: string;
  onQueryChange: (next: string) => void;
  engine: SearchEngineId;
  onEngineChange: (next: SearchEngineId) => void;
  loading: boolean;
  error: string | null;
  notices?: string[];
  onSearch: () => void;
}) {
  const { query, onQueryChange, engine, onEngineChange, loading, error, notices, onSearch } =
    props;

  const selectedEngine = SEARCH_ENGINES.find((e) => e.id === engine);
  const SelectedIcon = selectedEngine?.icon ?? Search;

  return (
    <section className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-col gap-3">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search sources"
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="bg-muted/30"
          />
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Select value={engine} onValueChange={(v) => onEngineChange(v as SearchEngineId)}>
                <SelectTrigger className="bg-muted/30 w-full">
                  <SelectValue placeholder="Engine">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <SelectedIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{selectedEngine?.name ?? "Engine"}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_ENGINES.map((eng) => (
                    <SelectItem key={eng.id} value={eng.id}>
                      <div className="flex items-center gap-2">
                        <eng.icon className="size-3.5" />
                        <span>{eng.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={onSearch}
              disabled={loading || !query.trim()}
              size="icon"
              title="Run search"
              aria-label="Run search"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {notices && notices.length > 0 && (
        <div className="space-y-2">
          {notices.map((n, i) => (
            <div
              key={i}
              className="bg-muted/40 border rounded-md p-3 text-sm text-muted-foreground"
            >
              {n}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
