"use client";

import { useState } from "react";
import { Globe, X } from "lucide-react";
import { useChat } from "ai/react";
import { WorkspaceRail } from "@/components/workspace-rail";
import { Button } from "@/components/ui/button";
import { SearchSection } from "./search-section";
import { ResultsList } from "./results-list";
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
    "You are Hudika, a Philippine legal research assistant. You help people understand " +
    "the laws that apply to their situation under Philippine law (Republic Acts, Presidential Decrees, " +
    "Executive Orders, Batas Pambansa, the 1987 Constitution, and Supreme Court jurisprudence).\n\n" +
    "ALWAYS VERIFY WITH TOOLS (non-negotiable):\n" +
    "- Never state a legal proposition, statute, section number, or case from memory. Every answer that " +
    "touches the law MUST be grounded in a tool result in this conversation.\n" +
    "- Before answering any legal question, run the relevant tools. If you cannot retrieve it, say so. " +
    "An unverified answer, however plausible, is a failure.\n\n" +
    "HOW TO RESEARCH (use the tools, do not answer from memory):\n" +
    "- Use search_ph_laws to find candidate Republic Acts, then get_ph_law to read the " +
    "verbatim text of the promising ones.\n" +
    "- Use search_ph_corpus for Presidential Decrees, Executive Orders, Batas Pambansa, " +
    "Commonwealth/Commission/Assembly Acts, the major statutes, and constitutional provisions; then " +
    "get_ph_code to read the verbatim text of the instrument it identifies.\n" +
    "- Use search_ph_cases to find relevant Supreme Court decisions, then get_ph_case to " +
    "confirm the holding before you rely on it.\n" +
    "- Use search_ph_constitution for constitutional questions.\n\n" +
    "CITATION RULES (most important):\n" +
    "- Cite a statute or case ONLY if you retrieved it with a tool in this conversation. " +
    "Never cite a section number, RA number, or case you have not actually read.\n" +
    "- When you cite an act, give the RA/PD/EO/BP number and the specific section, and quote or closely " +
    "paraphrase the text you retrieved. The LawPhil link in a tool result is the authoritative " +
    "source; you may include it.\n" +
    "- If the tools return no match or an error, say plainly that you could not verify the " +
    "provision in the legal database. NEVER invent or guess a citation. An honest 'I could not " +
    "verify this' is correct; a plausible but unverified citation is a serious failure.\n\n" +
    "HOW TO ANSWER:\n" +
    "- Be concise and direct. Lead with the answer.\n" +
    "- Where the law is settled, say so plainly. Where it is fact-dependent or genuinely " +
    "unsettled, say that too, and name what turns on it.\n" +
    "- Treat the user as someone seeking to understand their legal situation, not as opposing " +
    "counsel. Note the key facts that would change the answer, and any deadline or procedural " +
    "step that tends to be time-sensitive.\n" +
    "- Do not draft formal pleadings or give a guarantee of any outcome.\n" +
    "- Close substantive legal guidance by noting this is general information, not formal legal " +
    "advice, and that a Philippine licensed attorney should review their specific case. Keep this " +
    "to one short line, not a lecture.\n\n" +
    "OUTPUT FORMAT:\n" +
    "- Show your reasoning as you work, but do not output a separate 'Plan' section or meta-" +
    "commentary about your instructions.\n" +
    "- Start immediately with the substantive answer.";

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

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceRail onRestart={handleRestartChat} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatWidget
          messages={messages as unknown as UiChatMessage[]}
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={chatLoading}
          error={(chatError ?? null) as Error | null}
          onRetry={reload}
          composerActions={
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 lg:hidden"
              onClick={() => setSourcesOpen(true)}
              title="Sources"
              aria-label="Open sources"
            >
              <Globe className="size-4" />
            </Button>
          }
        />
      </main>

      <aside className="hidden w-[21rem] shrink-0 border-l border-border lg:block">
        <SourcesPane
          query={query}
          onQueryChange={setQuery}
          engine={engine}
          onEngineChange={setEngine}
          loading={loading}
          error={searchError}
          notices={notices}
          onSearch={handleSearch}
          results={results}
          onSelect={setSelectedResult}
        />
      </aside>

      {sourcesOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setSourcesOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(24rem,100%)] flex-col border-l border-border bg-background">
            <div className="flex justify-end border-b border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSourcesOpen(false)}
                title="Close sources"
                aria-label="Close sources"
              >
                <X className="size-4" />
              </Button>
            </div>
            <SourcesPane
              query={query}
              onQueryChange={setQuery}
              engine={engine}
              onEngineChange={setEngine}
              loading={loading}
              error={searchError}
              notices={notices}
              onSearch={handleSearch}
              results={results}
              onSelect={setSelectedResult}
            />
          </aside>
        </div>
      )}

      {selectedResult && (
        <SourceModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}

function SourcesPane(props: {
  query: string;
  onQueryChange: (next: string) => void;
  engine: SearchEngineId;
  onEngineChange: (next: SearchEngineId) => void;
  loading: boolean;
  error: string | null;
  notices: string[];
  onSearch: () => void;
  results: SearchResult[] | null;
  onSelect: (result: SearchResult) => void;
}) {
  const { loading, results } = props;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-5 py-5">
        <SearchSection
          query={props.query}
          onQueryChange={props.onQueryChange}
          engine={props.engine}
          onEngineChange={props.onEngineChange}
          loading={props.loading}
          error={props.error}
          notices={props.notices}
          onSearch={props.onSearch}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {loading ? (
          <p className="py-6 text-[0.8125rem] text-muted-foreground">Searching</p>
        ) : results && results.length > 0 ? (
          <ResultsList results={results} onSelect={props.onSelect} />
        ) : (
          <p className="py-6 text-[0.8125rem] text-muted-foreground">No sources yet.</p>
        )}
      </div>
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
