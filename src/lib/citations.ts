/**
 * Turns tool results attached to an assistant message into a compact,
 * deduplicated list of the sources and cases the answer was grounded on.
 *
 * The route's tools return plain-text blocks (see src/lib/juris.ts, src/lib/codes.ts
 * and the corpus worker) that carry identity lines like "ACT: RA 9003 (2000) - Title",
 * "DECISION: G.R. No. 232870 ...", "CODE: PD 442 ...", plus authoritative links as
 * "LAWPHIL (authoritative): <url>" and "JURIS record: <url>". We parse those.
 */

export type CitationKind = "case" | "statute" | "constitution" | "source";

export type Citation = {
  kind: CitationKind;
  label: string;
  title: string;
  url?: string;
};

const URL_RE = /https?:\/\/[^\s)\]}'"]+/g;

function parseUrls(line: string): string[] {
  const matches = line.match(URL_RE) ?? [];
  const urls: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:]+$/, "");
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") urls.push(cleaned);
    } catch {
      /* not a real URL, ignore */
    }
  }
  return urls;
}

type Parsed = {
  records: Citation[];
  lastRecord: Citation | null;
};

function record(parsed: Parsed, kind: CitationKind, label: string, title: string): Citation {
  const entry: Citation = { kind, label, title };
  parsed.records.push(entry);
  return entry;
}

function attachOrStandalone(parsed: Parsed, url: string, label: string, title: string) {
  if (parsed.lastRecord && !parsed.lastRecord.url) {
    parsed.lastRecord.url = url;
    return;
  }
  parsed.records.push({ kind: "source", label, title, url });
}

export function extractCitationsFromToolText(text: string): Citation[] {
  const parsed: Parsed = { records: [], lastRecord: null };
  let lastTitle = "";

  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length > 400) continue;

    const urls = parseUrls(line);

    const lawphil = line.match(/^LAWPHIL\s*\(authoritative\):\s*(.+)$/i);
    if (lawphil) {
      attachOrStandalone(parsed, lawphil[1].trim(), "LawPhil", "Authoritative source");
      continue;
    }

    const juris = line.match(/^JURIS\s*record:\s*(.+)$/i);
    if (juris) {
      attachOrStandalone(parsed, juris[1].trim(), "Juris", "Juris record");
      continue;
    }

    const act = line.match(/^ACT:\s*(RA\s*\d+)(?:\s+\((\d{4})\))?\s*[\u2014\u2013-]\s*(.+)$/i);
    if (act) {
      const label = act[2] ? `${act[1]} (${act[2]})` : act[1];
      parsed.lastRecord = record(parsed, "statute", label, act[3].trim());
      continue;
    }

    const decision = line.match(/^DECISION:\s*(.+?)(?:\s+\((\d{4})\))?\s*[\u2014\u2013-]\s*(.+)$/i);
    if (decision) {
      const label = decision[2] ? `${decision[1].trim()} (${decision[2]})` : decision[1].trim();
      parsed.lastRecord = record(parsed, "case", label, decision[3].trim());
      continue;
    }

    const code = line.match(/^CODE:\s*([A-Z]{2,6})\s+([A-Z0-9-]+)\s*[\u2014\u2013-]\s*(.+)$/i);
    if (code) {
      const type = code[1].toUpperCase();
      const label = `${type} ${code[2]}`;
      const kind: CitationKind = type === "CONST" ? "constitution" : "statute";
      parsed.lastRecord = record(parsed, kind, label, code[3].trim());
      continue;
    }

    const constitution = line.match(/^\[\d+\]\s*(.+?)\s*\(source:\s*(https?:\/\/\S+?)\s*\)$/i);
    if (constitution) {
      const ref = constitution[1].trim();
      const entry = record(parsed, "constitution", ref, "Constitution");
      entry.url = constitution[2];
      continue;
    }

    const corpusHit = line.match(/^\[\d+\]\s*([A-Z]{2,6}-?\d+)\s*\(score/i);
    if (corpusHit) {
      const key = corpusHit[1].toUpperCase();
      const kind: CitationKind = key.startsWith("CONST") ? "constitution" : "statute";
      const label = key.replace("-", " ");
      record(parsed, kind, label, "Curated statute corpus");
      continue;
    }

    const title = line.match(/^Title:\s*(.+)$/i);
    if (title) {
      lastTitle = title[1].trim();
      continue;
    }
    const url = line.match(/^URL:\s*(.+)$/i);
    if (url && lastTitle) {
      const u = url[1].trim();
      if (urls.length >= 0 && parseUrls(u).length === 1) {
        parsed.records.push({ kind: "source", label: lastTitle, title: "Web search source", url: parseUrls(u)[0] });
        lastTitle = "";
      }
    }
  }

  return dedupe(parsed.records);
}

function dedupe(citations: Citation[]): Citation[] {
  const seenUrls = new Set<string>();
  const seenLabels = new Set<string>();
  const out: Citation[] = [];

  for (const citation of citations) {
    if (citation.url) {
      if (seenUrls.has(citation.url)) continue;
      seenUrls.add(citation.url);
    } else {
      const key = `${citation.kind}:${citation.label}`;
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
    }
    out.push(citation);
  }

  const kindOrder: Record<CitationKind, number> = { case: 0, statute: 1, constitution: 2, source: 3 };
  return out.sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.label.localeCompare(b.label),
  );
}

function resultContentString(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const content = r.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const part = item as Record<string, unknown>;
      if (part.type === "text" && typeof part.text === "string") texts.push(part.text);
    }
    if (texts.length) return texts.join("\n\n");
  }
  return null;
}

/** Pull every tool result attached to one assistant message and parse the citations. */
export function getCitationsFromMessage(message: { parts?: unknown[] }): Citation[] {
  const collected: Citation[] = [];
  const parts = Array.isArray(message.parts) ? message.parts : [];

  for (const part of parts as Array<Record<string, unknown>>) {
    if (!part || typeof part !== "object") continue;

    let result: unknown = null;
    switch (part.type) {
      // AI SDK v4 UI shape: { type: "tool-invocation", toolInvocation: { state, result, ... } }
      case "tool-invocation": {
        const invocation = part.toolInvocation;
        if (!invocation || typeof invocation !== "object") continue;
        const ti = invocation as Record<string, unknown>;
        if (ti.state !== "result") continue;
        result = ti.result;
        break;
      }
      // v4 server/legacy shapes
      case "tool":
        if (part.state !== "result") continue;
        result = part.result;
        break;
      case "tool-result":
        result = part.result;
        break;
      default:
        continue;
    }

    const content = resultContentString(result);
    if (content) collected.push(...extractCitationsFromToolText(content));
  }

  return dedupe(collected);
}