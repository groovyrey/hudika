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
};
