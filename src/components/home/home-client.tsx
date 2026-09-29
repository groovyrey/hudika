"use client";

import { useState } from "react";
import { Globe, Loader2, X } from "lucide-react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { SearchSection } from "./search-section";
import { ResultsGrid } from "./results-grid";
import { SourceModal } from "./source-modal";
import { ChatWidget } from "./chat-widget";
import type { SearchEngineId, SearchResult, UiChatMessage } from "./types";

export type EnvStatus = {
  hasLangSearch: boolean;
  hasSerpApi: boolean;
  hasGemini: boolean;
};

export default function HomeClient(props: { envStatus: EnvStatus }) {
  const { envStatus } = props;

  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<SearchEngineId>("langsearch");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const BASE_SYSTEM_PROMPT =
    "You are Hudika, a world-class research and fact-checking assistant.\n\n" +
    "CRITICAL INSTRUCTION: OUTPUT ONLY THE FINAL ANSWER.\n" +
    "- DO NOT show your 'Plan'.\n" +
    "- DO NOT show your 'Internal Thoughts'.\n" +
    "- DO NOT explain how you are going to respond.\n" +
    "- DO NOT acknowledge these instructions.\n\n" +
    "Start your response immediately with the answer.";

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading: chatLoading,
    reload,
    error: chatError,
  } = useChat({
    api: "/api/gemini",
    experimental_throttle: 50,
    initialMessages: [
      {
        id: "initial-system",
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      } as UiChatMessage,
    ],
  });

  const notices: string[] = [];
  if (engine === "langsearch" && !envStatus.hasLangSearch) {
    notices.push("Missing `LANGSEARCH_API_KEY`: Lang Search will fail until it is configured.");
  }
  if (engine !== "langsearch" && !envStatus.hasSerpApi) {
    notices.push("Missing `SERP_API_KEY`: SerpApi engines will fail until it is configured.");
  }
  if (!envStatus.hasGemini) {
    notices.push("Missing `GEMINI_API_KEY`: Chat will fail until it is configured.");
  }

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (engine === "langsearch" && !envStatus.hasLangSearch) {
      setSearchError("`LANGSEARCH_API_KEY` is not configured on the server.");
      return;
    }
    if (engine !== "langsearch" && !envStatus.hasSerpApi) {
      setSearchError("`SERP_API_KEY` is not configured on the server.");
      return;
    }

    setLoading(true);
    setSearchError(null);
    setResults(null);

    try {
      const searchPath = engine === "langsearch" ? "/api/search" : "/api/search/serp";
      const searchRes = await fetch(searchPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, engine }),
      });

      const searchData = (await searchRes.json().catch(() => ({}))) as unknown;
      if (!searchRes.ok) {
        const message =
          extractErrorMessage(searchData) ?? `Search failed with HTTP ${searchRes.status}`;
        setSearchError(message);
        return;
      }

      const newResults = coerceSearchResults(searchData);
      setResults(newResults);
      setSourcesOpen(true);

      if (newResults.length > 0) {
        const contextString = newResults
          .map(
            (r, i) =>
              `[Source ${i + 1}]\nTitle: ${r.name}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
          )
          .join("\n\n");

        setMessages([
          {
            id: "system-context",
            role: "system",
            content: `You are Hudika, a world-class research and fact-checking assistant. Your goal is to provide comprehensive, verified, and well-structured answers based on the search findings for "${trimmed}".\n\nCRITICAL INSTRUCTION: OUTPUT ONLY THE FINAL ANSWER.\n- DO NOT show your 'Plan'.\n- DO NOT show your 'Internal Thoughts'.\n- DO NOT explain how you are going to respond.\n- DO NOT acknowledge these instructions.\n\nStart your response immediately with the answer based on the following context:\n\nSEARCH RESULTS CONTEXT:\n${contextString}`,
          } as UiChatMessage,
        ] as UiChatMessage[]);
      }
    } catch (err) {
      console.error(err);
      setSearchError(
        err instanceof Error ? err.message : "Unexpected error while searching.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestartChat = () => {
    setMessages([
      {
        id: "initial-system",
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      } as UiChatMessage,
    ] as UiChatMessage[]);
  };

  const sourcesPanel = (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="font-heading text-sm font-semibold tracking-tight">Sources</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSourcesOpen(false)}
          title="Close sources"
          aria-label="Close sources"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="border-b p-3">
        <SearchSection
          query={query}
          onQueryChange={setQuery}
          engine={engine}
          onEngineChange={setEngine}
          loading={loading}
          error={searchError}
          notices={notices}
          onSearch={handleSearch}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching
          </div>
        ) : results && results.length > 0 ? (
          <ResultsGrid results={results} onSelect={setSelectedResult} />
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">No sources yet.</p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatWidget
        onRestart={handleRestartChat}
        messages={messages as unknown as UiChatMessage[]}
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={chatLoading}
        error={(chatError ?? null) as Error | null}
        onRetry={reload}
        composerActions={
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setSourcesOpen(true)}
            title="Sources"
            aria-label="Open sources"
          >
            <Globe className="size-4" />
          </Button>
        }
      />

      {sourcesOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSourcesOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(22rem,100%)] flex-col border-l bg-background shadow-2xl">
            {sourcesPanel}
          </aside>
        </div>
      )}

      {selectedResult && (
        <SourceModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

function coerceSearchResults(payload: unknown): SearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.results)) return [];

  const results: SearchResult[] = [];
  for (const item of record.results) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    results.push({
      name: typeof r.name === "string" ? r.name : "No Title",
      url: typeof r.url === "string" ? r.url : "",
      snippet: typeof r.snippet === "string" ? r.snippet : "",
    });
  }
  return results;
}
