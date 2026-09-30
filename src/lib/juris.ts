/**
 * Juris (https://juris.ph) — Philippine jurisprudence + Republic Acts client.
 *
 * Juris is a free, public MCP (Model Context Protocol) server run by BetterGov.ph.
 * The corpus text comes from LawPhil (Arellano Law Foundation) and the Supreme Court,
 * and the underlying laws/decisions are in the public domain (RA 8293, Sec. 176).
 * AI-generated summaries/tags on Juris are research aids, NOT authoritative — the
 * verbatim `full_text` plus the `source_url` (LawPhil) are what we cite.
 *
 * Why a thin JSON-RPC client instead of an MCP SDK:
 *   - ai@4 has no first-class MCP client, and the SDKs add dependencies for little gain.
 *   - We call the read-only `tools/call` JSON-RPC method directly with fetch. The
 *     server is stateless Streamable HTTP, so a single POST per call is all that's needed.
 *
 * An optional caching proxy (a Cloudflare Worker) can sit in front via JURIS_PROXY_URL.
 * When set, requests go through the proxy (shared cache, per-user auth) and the raw
 * Juris host is only hit on a cache miss. When unset, we call Juris directly.
 */

import { logger } from "@/lib/logger";

const JURIS_MCP = process.env.JURIS_MCP_URL ?? "https://juris.ph/mcp";
// Optional caching/gating proxy (the `hudika` Cloudflare Worker, account 3).
// When JURIS_PROXY_URL is set we route through it; otherwise we call Juris directly.
const JURIS_PROXY = process.env.JURIS_PROXY_URL;
const JURIS_PROXY_KEY = process.env.JURIS_PROXY_KEY ?? "";
const JURIS_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 400;

// One retry for transient upstream failures (network blips, 5xx, 429). A
// cached record behind the worker proxy makes this nearly free on repeats.
function retryable(failure: unknown, status?: number): boolean {
  if (status !== undefined && status < 500 && status !== 429) return false;
  return true;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cap on how much verbatim text we hand back per act/case. The Civil Code, for
// example, is ~790KB as a single blob — that would blow the context window. We
// truncate and always surface the LawPhil source_url so the full text stays reachable.
const FULL_TEXT_CHAR_CAP = 18_000;
const SEARCH_RESULT_CAP = 8;

// When the caching proxy is not configured we call Juris directly, which means
// nothing upstream is throttling a runaway tool loop. Keep a coarse per-process
// guard so we stay a polite client of a volunteer-run service. The Worker applies
// a real per-IP limit; this is the backstop for direct mode.
const DIRECT_CALL_BUDGET = 120; // calls per minute across this process
let directCallCount = 0;
let directWindowStart = Date.now();

function allowDirectCall(): boolean {
  if (JURIS_PROXY) return true; // proxy handles its own limiting
  const now = Date.now();
  if (now - directWindowStart > 60_000) {
    directCallCount = 0;
    directWindowStart = now;
  }
  directCallCount += 1;
  return directCallCount <= DIRECT_CALL_BUDGET;
}

type McpToolName =
  | "search_republic_acts"
  | "get_republic_act"
  | "search_jurisprudence"
  | "get_case"
  | "search_constitutions";

type JsonRpcResponse = {
  result?: { content?: { type?: string; text?: string }[] };
  error?: { message?: string };
};

/** Perform a read-only MCP tools/call. Returns the raw JSON payload the tool produced. */
async function mcpCall(tool: McpToolName, args: Record<string, unknown>): Promise<unknown> {
  if (!allowDirectCall()) {
    throw new Error("legal lookup rate limit reached, please retry shortly");
  }
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: tool, arguments: args },
  });

  // Route through the caching proxy when configured; otherwise call Juris directly.
  const useProxy = Boolean(JURIS_PROXY);
  const url = useProxy ? (JURIS_PROXY as string) : JURIS_MCP;

  let lastErr: unknown = null;
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      // The proxy is gated on a shared secret and fails closed without it.
      ...(useProxy ? { "x-juris-key": JURIS_PROXY_KEY } : {}),
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(JURIS_TIMEOUT_MS),
      });
      if (res.ok) {
        const rpc = (await res.json()) as JsonRpcResponse;
        if (rpc.error) {
          throw new Error(`Juris tool error: ${rpc.error.message ?? "unknown"}`);
        }
        const text = rpc.result?.content?.find((c) => c.type === "text")?.text;
        if (typeof text !== "string") return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      lastStatus = res.status;
      lastErr = new Error(`Juris upstream error: ${res.status} ${res.statusText}`);
      if (!retryable(lastErr, res.status)) break;
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 0 && retryable(lastErr, lastStatus)) await sleep(RETRY_DELAY_MS);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec {
  return v && typeof v === "object" ? (v as Rec) : {};
}
function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNum(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

/**
 * Juris returns "Republic Act No. 8437", "RA No. 7644", "9341", or
 * "REPUBLIC ACT NO. 9161" depending on the source record. Reduce all of them to a
 * bare number so we never print nonsense like "RA REPUBLIC ACT NO 9161".
 */
function normalizeRaNumber(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== "string") return "";
  const digits = raw.replace(/[^0-9]/g, "");
  return digits || raw.trim();
}

/** Juris signals a miss with a bare "not found" string, or a { note } object. */
function isNotFound(raw: unknown): boolean {
  if (typeof raw === "string") return /not found|no (act|decision|record)|no results/i.test(raw);
  const r = asRec(raw);
  if (r.note && !Array.isArray(r.results)) return true;
  return false;
}

function safe(fn: () => unknown, label: string): unknown {
  try {
    return fn();
  } catch (e) {
    logger.error(`juris: formatting error in ${label}`, { message: String(e) });
    return null;
  }
}

/**
 * Compact, token-efficient rendering of a statute for the LLM.
 * Prioritizes: identity, verbatim text (capped), section index, authoritative link.
 */
function formatAct(raw: unknown): string {
  const r = asRec(raw);
  const id = asStr(r.id);
  const raNumber = normalizeRaNumber(r.ra_bill_number) || normalizeRaNumber(r.ra_number_int);
  const title = asStr(r.title, "Untitled Act");
  const year = asNum(r.year);
  const sourceUrl = asStr(r.source_url);
  const jurisUrl = asStr(r.url);

  const parts: string[] = [];
  parts.push(`ACT: RA ${raNumber} (${year}) — ${title}`);
  parts.push(`LAWPHIL (authoritative): ${sourceUrl || "n/a"}`);
  if (jurisUrl) parts.push(`JURIS record: ${jurisUrl}`);
  if (id) parts.push(`id: ${id}`);

  // Verbatim full text, truncated with an explicit pointer to the full source.
  const fullText = asStr(r.full_text);
  if (fullText) {
    if (fullText.length > FULL_TEXT_CHAR_CAP) {
      parts.push(
        `FULL TEXT (verbatim, first ${FULL_TEXT_CHAR_CAP} of ${fullText.length} chars — ` +
          `the rest is at the LawPhil link above):\n${fullText.slice(0, FULL_TEXT_CHAR_CAP)}\n[...truncated]`,
      );
    } else {
      parts.push(`FULL TEXT (verbatim):\n${fullText}`);
    }
  } else {
    parts.push("(full text not returned; fetch with include_full_text)");
  }

  // Per-section index helps the model point to the right section without re-reading.
  const sections = Array.isArray(r.sections) ? (r.sections as unknown[]) : [];
  if (sections.length) {
    const lines = safe(
      () =>
        sections
          .slice(0, 60)
          .map((s) => {
            const sr = asRec(s);
            const t = asStr(sr.title, "Section");
            const sum = asStr(sr.summary, "").replace(/\s+/g, " ").trim();
            return `  - ${t}${sum ? `: ${sum}` : ""}`;
          })
          .join("\n"),
      "act.sections",
    );
    if (typeof lines === "string") {
      parts.push(
        `SECTION INDEX (AI-generated summaries, may be incomplete — verify against full text):\n${lines}`,
      );
    }
  }

  return parts.join("\n\n");
}

function formatSearchResults(raw: unknown, kind: "act" | "case"): string {
  const r = asRec(raw);
  const results = Array.isArray(r.results) ? (r.results as unknown[]) : [];
  if (results.length === 0) {
    const note = asStr(r.note, "No relevant matches.");
    return `NO MATCHES. ${note} Try a broader query, or look up a known act number directly with ${kind === "act" ? "get_ph_law" : "get_ph_case"}.`;
  }

  const lines = results.slice(0, SEARCH_RESULT_CAP).map((item, i) => {
    const ir = asRec(item);
    if (kind === "act") {
      const ra = normalizeRaNumber(ir.ra_number) || normalizeRaNumber(ir.ra_number_int);
      const title = asStr(ir.title, "Untitled").replace(/\s+/g, " ");
      const year = asNum(ir.year);
      const id = asStr(ir.id);
      const score = asNum(ir.score, 0).toFixed(3);
      return (
        `[${i + 1}] RA ${ra} (${year}) — ${title}\n` +
        `    relevance=${score} id=${id}\n` +
        `    -> fetch verbatim text with get_ph_law({ ra_number: "${ra}" }) or get_ph_law({ id: "${id}" })`
      );
    }
    const caseNo = asStr(ir.case_number, "?");
    const ctitle = asStr(ir.case_title, "Untitled").replace(/\s+/g, " ");
    const year = asNum(ir.year);
    const id = asStr(ir.id);
    const score = asNum(ir.score, 0).toFixed(3);
    return (
      `[${i + 1}] ${caseNo} (${year}) — ${ctitle}\n` +
      `    relevance=${score} id=${id}\n` +
      `    -> fetch full decision with get_ph_case({ id: "${id}" })`
    );
  });

  return `${kind === "act" ? "REPUBLIC ACTS" : "JURISPRUDENCE"} FOUND:\n${lines.join("\n\n")}`;
}

// ---- Public tool entry points (each returns compact text for the LLM) ----

export async function searchRepublicActs(args: {
  query: string;
  limit?: number;
  year?: number;
}): Promise<string> {
  try {
    const raw = await mcpCall("search_republic_acts", {
      query: args.query,
      limit: Math.min(args.limit ?? 5, SEARCH_RESULT_CAP),
      ...(args.year ? { year: args.year } : {}),
    });
    return formatSearchResults(raw, "act");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("juris searchRepublicActs failed", { message: msg });
    return `Search unavailable (${msg}). Do NOT invent a citation; tell the user the legal database is temporarily unreachable.`;
  }
}

export async function getRepublicAct(args: {
  id?: string;
  ra_number?: string;
}): Promise<string> {
  try {
    const raw = await mcpCall("get_republic_act", {
      ...(args.id ? { id: args.id } : {}),
      ...(args.ra_number ? { ra_number: args.ra_number } : {}),
      include_full_text: true,
    });
    if (!raw || isNotFound(raw)) {
      return `No Republic Act found for ${args.id ?? args.ra_number}. That number may be wrong, or the act may not be in the database. Do NOT guess a different section or act; report that you could not verify it.`;
    }
    return formatAct(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("juris getRepublicAct failed", { message: msg });
    return `Could not retrieve act (${msg}). Do not fabricate its text or section numbers.`;
  }
}

export async function searchJurisprudence(args: {
  query: string;
  limit?: number;
  year?: number;
  case_type?: string;
}): Promise<string> {
  try {
    const raw = await mcpCall("search_jurisprudence", {
      query: args.query,
      limit: Math.min(args.limit ?? 5, SEARCH_RESULT_CAP),
      ...(args.year ? { year: args.year } : {}),
      ...(args.case_type ? { case_type: args.case_type } : {}),
    });
    return formatSearchResults(raw, "case");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("juris searchJurisprudence failed", { message: msg });
    return `Search unavailable (${msg}). Do NOT invent a case; tell the user the legal database is temporarily unreachable.`;
  }
}

export async function getCase(args: {
  id?: string;
  case_number?: string;
}): Promise<string> {
  try {
    const raw = await mcpCall("get_case", {
      ...(args.id ? { id: args.id } : {}),
      ...(args.case_number ? { case_number: args.case_number } : {}),
      include_full_text: true,
    });
    if (!raw || isNotFound(raw)) {
      return `No decision found for ${args.id ?? args.case_number}. Do NOT invent a holding or citation; report that you could not verify it.`;
    }

    const r = asRec(raw);
    const parts: string[] = [];
    parts.push(
      `DECISION: ${asStr(r.case_number, "?")} (${asNum(r.year)}) — ${asStr(r.case_title, "Untitled")}`,
    );
    parts.push(`Court: ${asStr(r.court, "Supreme Court of the Philippines")}`);
    const sourceUrl = asStr(r.source_url);
    if (sourceUrl) parts.push(`LAWPHIL (authoritative): ${sourceUrl}`);
    if (asStr(r.url)) parts.push(`JURIS record: ${asStr(r.url)}`);

    const fullText = asStr(r.full_text);
    if (fullText) {
      if (fullText.length > FULL_TEXT_CHAR_CAP) {
        parts.push(
          `DECISION TEXT (verbatim, first ${FULL_TEXT_CHAR_CAP} of ${fullText.length} chars — ` +
            `the rest is at the LawPhil link above):\n${fullText.slice(0, FULL_TEXT_CHAR_CAP)}\n[...truncated]`,
        );
      } else {
        parts.push(`DECISION TEXT (verbatim):\n${fullText}`);
      }
    }
    return parts.join("\n\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("juris getCase failed", { message: msg });
    return `Could not retrieve decision (${msg}). Do not fabricate a holding or citation.`;
  }
}

export async function searchConstitution(args: { query: string; article?: string }): Promise<string> {
  try {
    const raw = await mcpCall("search_constitutions", {
      query: args.query,
      limit: 5,
      ...(args.article ? { article: args.article } : {}),
    });
    const r = asRec(raw);
    const results = Array.isArray(r.results) ? (r.results as unknown[]) : [];
    if (!results.length) {
      return `NO MATCHES. ${asStr(r.note, "No relevant constitutional provision found.")}`;
    }
    const lines = results.slice(0, 5).map((item, i) => {
      const ir = asRec(item);
      const text = asStr(ir.text, "").replace(/\s+/g, " ").trim();
      // Prefer the human citation ("Article III, Section 14") over the raw id.
      const ref =
        asStr(ir.title) || asStr(ir.unit_id) || asStr(ir.id, "provision");
      const src = asStr(ir.source_url);
      return (
        `[${i + 1}] ${ref}${src ? ` (source: ${src})` : ""}\n    ${text.slice(0, 700)}`
      );
    });
    return `CONSTITUTIONAL PROVISIONS FOUND:\n${lines.join("\n\n")}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("juris searchConstitution failed", { message: msg });
    return `Search unavailable (${msg}).`;
  }
}
