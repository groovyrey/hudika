/**
 * Hudika curated Codes client — the `hudika` Cloudflare Worker (account 3).
 *
 * Covers the statute layer Juris does not: Presidential Decrees, Executive
 * Orders, Batas Pambansa, Commonwealth/Commission/Assembly Acts, and the 1987
 * Constitution (plus the major Republic Acts that anchor daily legal questions).
 *
 * Two modes, both deterministic and citation-grade:
 *   /legal/code    exact lookup of one Code by { type, number } or { title },
 *                  returning verbatim chunks from D1 (bettergov gov-library,
 *                  scraped from LawPhil, public domain).
 *   /legal/corpus  hybrid semantic+keyword search over the same corpus via a
 *                  Cloudflare AI Search instance. It tells the model which
 *                  instrument covers a point; /legal/code supplies the text.
 *
 * The worker is gated on the same x-juris-key as the Juris proxy.
 */

import { logger } from "@/lib/logger";

function jurisProxyOrigin(): string {
  const p = process.env.JURIS_PROXY_URL;
  if (!p) return "";
  try {
    return new URL(p).origin;
  } catch {
    return "";
  }
}

// Worker base URL. CANNOT be constructed at import time (env reads happen at
// module load, which is fine for env vars, but keep it simple and explicit).
const WORKER_URL = (process.env.HUDIKA_WORKER_URL ?? jurisProxyOrigin()).replace(/\/+$/, "");
const GATE_KEY = process.env.JURIS_PROXY_KEY ?? "";
const TIMEOUT_MS = 20_000;

async function postLegal(path: string, body: Record<string, unknown>, method: "POST" = "POST"): Promise<Record<string, unknown>> {
  if (!WORKER_URL) {
    throw new Error("HUDIKA_WORKER_URL is not set; the curated statute tools are unavailable.");
  }
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(GATE_KEY ? { "x-juris-key": GATE_KEY } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`legal corpus upstream error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function formatError(message: string, kind: string): string {
  logger.error(`codes: ${kind} failed`, { message });
  return `Legal corpus lookup failed (${message}). Do NOT fabricate the provision, its number, or its text; report that the check could not be completed.`;
}

export async function getCode(args: {
  type?: string;
  number?: number;
  title?: string;
}): Promise<string> {
  try {
    const body: Record<string, unknown> = {};
    if (args.type) body.type = args.type;
    if (args.number !== undefined) body.number = args.number;
    if (args.title) body.title = args.title;
    if (!body.type && !body.number && !body.title) {
      return "get_ph_code requires { type, number }, { type }, or { title }. Example: { type: 'PD', number: 442 }.";
    }
    const data = await postLegal("/legal/code", body);
    return String(data.format ?? (data.error ? `CODE LOOKUP FAILED: ${String(data.error)}` : "No result."));
  } catch (e) {
    return formatError(e instanceof Error ? e.message : String(e), "getCode");
  }
}

export async function searchCodeCorpus(args: {
  query: string;
  limit?: number;
}): Promise<string> {
  try {
    if (!args.query || !args.query.trim()) {
      return "search_ph_corpus requires a plain-language query.";
    }
    const data = await postLegal("/legal/corpus", {
      query: args.query,
      limit: Math.min(args.limit ?? 6, 10),
    });
    return String(data.format ?? (data.error ? `CORPUS SEARCH FAILED: ${String(data.error)}` : "No result."));
  } catch (e) {
    return formatError(e instanceof Error ? e.message : String(e), "searchCodeCorpus");
  }
}