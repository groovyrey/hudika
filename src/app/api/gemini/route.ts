import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { logger } from "@/lib/logger";

import {
  getCase,
  getRepublicAct,
  searchConstitution,
  searchJurisprudence,
  searchRepublicActs,
} from "@/lib/juris";
import { getCode, searchCodeCorpus } from "@/lib/codes";
import { rateLimit } from "@/lib/rate-limit";
import { fetchUrlTextBestEffort } from "@/lib/url-fetch";

export const runtime = "nodejs";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-31b-it";
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta",
});

const SERP_ENDPOINT = "https://serpapi.com/search";

async function googleSearch(query: string) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return "Error: SERP_API_KEY is not set";

  const limiter = await rateLimit("google_search", 5, 10 * 60 * 1000);
  if (!limiter.success) {
    const minutes = Math.ceil((limiter.resetIn || 0) / 60000);
    return `Error: Google Search rate limit exceeded. Please wait ${minutes} minutes.`;
  }

  try {
    const url = new URL(SERP_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("engine", "google");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString());
    const data = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      const err = extractStringField(data, "error") ?? "SerpApi error";
      return `Error performing search: ${err}`;
    }

    const organic = extractArrayField(data, "organic_results") ?? [];
    const results = organic
      .slice(0, 5)
      .map((item) => {
        const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const title = extractStringField(r, "title") ?? "No Title";
        const link = extractStringField(r, "link") ?? "";
        const snippet = extractStringField(r, "snippet") ?? "";
        return `Title: ${title}\nURL: ${link}\nSnippet: ${snippet}`;
      })
      .join("\n\n");
    return results || "No results found.";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return `Error performing search: ${message}`;
  }
}

export async function POST(req: Request) {
  try {
    const body = GeminiBodySchema.parse(await req.json());
    const messages = body.messages;
    logger.info("POST /api/gemini: Request received", { model: GEMINI_MODEL });

    const result = await streamText({
      model: google(GEMINI_MODEL),
      system: messages.find((m) => m.role === "system")?.content,
      messages: messages.filter((m) => m.role !== "system"),
      experimental_continueSteps: true,
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      },
      tools: {
        google_search: tool({
          description: "Performs a Google search to find new information.",
          parameters: z.object({
            query: z.string().describe("The search query to look up on Google."),
          }),
          execute: async ({ query }) => ({ content: await googleSearch(query) }),
        }),
        fetch_url: tool({
          description: "Fetches the content of a specific URL and returns the text content.",
          parameters: z.object({
            url: z.string().describe("The URL to fetch content from."),
          }),
          execute: async ({ url }) => ({ content: await fetchUrlTextBestEffort(url) }),
        }),
        // --- Philippine legal research (Juris / LawPhil / SC, public domain) ---
        search_ph_laws: tool({
          description:
            "Semantic search over Philippine Republic Acts. Returns candidate acts (RA number + title). " +
            "Then call get_ph_law for the promising ones to read their verbatim text. Prefer a plain-language " +
            "legal question over keywords. Use this to find which statutes could apply.",
          parameters: z.object({
            query: z.string().describe("The legal question or subject matter, in plain language."),
            limit: z.number().int().min(1).max(8).optional().describe("Max results (default 5)."),
            year: z.number().int().optional().describe("Only acts enacted this year."),
          }),
          execute: async ({ query, limit, year }) => ({
            content: await searchRepublicActs({ query, limit, year }),
          }),
        }),
        get_ph_law: tool({
          description:
            "Fetch the verbatim text of one Philippine Republic Act by RA number or by id from search_ph_laws. " +
            "Cite statutes only from text returned by this tool, and quote or reference the exact section.",
          parameters: z.object({
            ra_number: z
              .string()
              .optional()
              .describe("The RA number, e.g. '9502'. Use this for a known act."),
            id: z.string().optional().describe("The id from search_ph_laws results."),
          }),
          execute: async ({ ra_number, id }) => ({
            content: await getRepublicAct({ ra_number, id }),
          }),
        }),
        // --- Curated Philippine Codes (PD/EO/BP/CA/Act + 1987 Const, D1 + AI Search) ---
        search_ph_corpus: tool({
          description:
            "Semantic search over the curated Philippine statute corpus. Covers Presidential Decrees, " +
            "Executive Orders, Batas Pambansa, Commonwealth/Commission/Assembly Acts, the 1987 Constitution, " +
            "and the major Republic Acts. Returns the matching instrument and verbatim chunks with source. " +
            "Use this when the law subject is a PD, EO, BP, CA, Act, or constitutional provision, or when " +
            "search_ph_laws returns nothing useful. Then call get_ph_code to read the full verbatim text.",
          parameters: z.object({
            query: z.string().describe("The legal question or subject matter, in plain language."),
            limit: z.number().int().min(1).max(10).optional().describe("Max results (default 6)."),
          }),
          execute: async ({ query, limit }) => ({
            content: await searchCodeCorpus({ query, limit }),
          }),
        }),
        get_ph_code: tool({
          description:
            "Fetch the verbatim text of one curated Philippine Code by type + number, or search the corpus " +
            "by title keyword. Types: RA, PD, EO, BP, CA, ACT, CONST. Examples: { type: 'PD', number: 442 } " +
            "(Labor Code), { type: 'EO', number: 209 } (Family Code), { type: 'ACT', number: 3815 } (Revised " +
            "Penal Code), { type: 'BP', number: 881 } (Omnibus Election Code), { type: 'CONST', number: 1987 } " +
            "(1987 Constitution), { type: 'RA', number: 386 } (Civil Code). Cite only text returned here.",
          parameters: z.object({
            type: z.string().optional().describe("Instrument type: RA, PD, EO, BP, CA, ACT, or CONST."),
            number: z.number().int().min(1).optional().describe("Instrument number, e.g. 442."),
            title: z.string().optional().describe("Title keyword search when type/number are unknown."),
          }),
          execute: async ({ type, number, title }) => ({
            content: await getCode({ type, number, title }),
          }),
        }),
        search_ph_cases: tool({
          description:
            "Semantic search over Philippine Supreme Court decisions. Returns case numbers and titles. " +
            "Then call get_ph_case to read the decision. Use for doctrine, holdings, and precedents.",
          parameters: z.object({
            query: z.string().describe("The legal issue or fact pattern, in plain language."),
            limit: z.number().int().min(1).max(8).optional().describe("Max results (default 5)."),
            year: z.number().int().optional().describe("Only decisions promulgated this year."),
            case_type: z
              .string()
              .optional()
              .describe('Filter by case type, e.g. "Labor", "Civil", "Criminal", "Administrative".'),
          }),
          execute: async ({ query, limit, year, case_type }) => ({
            content: await searchJurisprudence({ query, limit, year, case_type }),
          }),
        }),
        get_ph_case: tool({
          description:
            "Fetch the verbatim text of one Philippine Supreme Court decision by id (from search_ph_cases) " +
            "or by case number (e.g. 'G.R. No. 232870'). Use it to confirm a holding before citing it.",
          parameters: z.object({
            id: z.string().optional().describe("The id from search_ph_cases results."),
            case_number: z.string().optional().describe("The case number, e.g. 'G.R. No. 232870'."),
          }),
          execute: async ({ id, case_number }) => ({ content: await getCase({ id, case_number }) }),
        }),
        search_ph_constitution: tool({
          description: "Search the 1987 Philippine Constitution for a relevant provision or right.",
          parameters: z.object({
            query: z.string().describe("The constitutional right or provision, in plain language."),
            article: z.string().optional().describe("Article filter, e.g. 'III' or 'IX-A'."),
          }),
          execute: async ({ query, article }) => ({ content: await searchConstitution({ query, article }) }),
        }),
      },
      maxSteps: 6,
      onFinish: ({ text }) => {
        logger.info("Assistant response completed", {
          textLength: text.length,
          preview: text.slice(0, 300),
        });
      },
    });

    return result.toDataStreamResponse({
      sendReasoning: true,
      getErrorMessage: (error) => {
        logger.error("Stream Error", error);
        return error instanceof Error ? error.message : String(error);
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("POST /api/gemini: Error initializing stream", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

const GeminiBodySchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
});

function extractArrayField(payload: unknown, key: string): unknown[] | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return Array.isArray(record[key]) ? (record[key] as unknown[]) : null;
}

function extractStringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record[key] === "string" ? (record[key] as string) : null;
}
