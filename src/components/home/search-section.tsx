"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <section className="space-y-4">
      <div className="space-y-3">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search sources"
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="h-9 border-input bg-transparent text-[0.8125rem] shadow-none"
        />
        <div className="flex items-center gap-3">
          <Select value={engine} onValueChange={(v) => onEngineChange(v as SearchEngineId)}>
            <SelectTrigger className="h-8 w-full border-input bg-transparent text-[0.8125rem] shadow-none">
              <SelectValue placeholder="Engine">
                <span className="flex items-center gap-2 overflow-hidden">
                  <SelectedIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{selectedEngine?.name ?? "Engine"}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SEARCH_ENGINES.map((eng) => (
                <SelectItem key={eng.id} value={eng.id}>
                  <span className="flex items-center gap-2">
                    <eng.icon className="size-3.5" />
                    <span>{eng.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={onSearch}
            disabled={loading || !query.trim()}
            size="sm"
            className="h-8 shrink-0 border-input px-3 text-[0.8125rem] font-normal"
          >
            {loading ? "Searching" : "Search"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="border-l-2 border-destructive pl-3 text-[0.8125rem] text-destructive">
          {error}
        </p>
      )}

      {notices && notices.length > 0 && (
        <div className="space-y-2">
          {notices.map((n, i) => (
            <p key={i} className="text-[0.75rem] leading-relaxed text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
