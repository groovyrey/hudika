import type { Message } from "ai";

export type SearchEngineId =
  | "langsearch"
  | "google"
  | "google_scholar"
  | "bing"
  | "baidu";

export type SearchResult = {
  name: string;
  url: string;
  snippet: string;
};

export type UiChatMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "data";
  content: string;
  reasoning?: string;
  /**
   * AI SDK message parts attached by `useChat`. Assistant messages carry `tool`
   * parts with `state: "result"` whose `result.content` holds the tool output we
   * parse into citations.
   */
  parts?: Message["parts"];
};
