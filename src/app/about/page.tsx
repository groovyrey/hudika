import type { Metadata } from "next";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";

export const metadata: Metadata = {
  title: "About Hudika",
  description: "How Hudika verifies Philippine law and where its legal sources come from.",
};

const sources = [
  {
    name: "LawPhil",
    href: "https://www.lawphil.net",
    host: "lawphil.net",
    src: "/logos/lawphil.png",
    tagline:
      "Arellano Law Foundation. Hosts the statute and decision texts; every Hudika citation links back here.",
  },
  {
    name: "Juris (BetterGov)",
    href: "https://juris.ph",
    host: "juris.ph",
    src: "/logos/juris.png",
    wideLogo: true,
    tagline:
      "Searches and returns Supreme Court decisions, Republic Acts, and the Constitution with full text.",
  },
  {
    name: "BetterGov Gov Library",
    href: "https://github.com/bettergovph/gov-library",
    host: "github.com/bettergovph/gov-library",
    src: "/logos/github.png",
    invertInDark: true,
    tagline:
      "The public-domain corpus behind Hudika's Presidential Decrees, Executive Orders, Batas Pambansa, and other Acts.",
  },
  {
    name: "Supreme Court of the Philippines",
    href: "https://sc.judiciary.gov.ph",
    host: "sc.judiciary.gov.ph",
    src: "https://sc.judiciary.gov.ph/favicon.ico",
    tagline: "The source court system behind the jurisprudence Hudika retrieves.",
  },
  {
    name: "Google (Gemini)",
    href: "https://ai.google.dev",
    host: "ai.google.dev",
    src: "/logos/google.png",
    tagline: "Hudika reasons with the gemma-4-31b-it model served through Google's Gemini API.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <h1 className="font-serif text-3xl leading-tight tracking-[-0.02em] sm:text-4xl">
        About Hudika
      </h1>

      <p className="mt-6 max-w-[62ch] text-[0.9375rem] leading-relaxed text-foreground">
        Hudika is a Philippine legal research assistant. It looks up the actual statute, the actual
        decision, or the actual constitutional provision before it answers, and it cites only what it
        can retrieve. When it cannot verify something, it says so instead of guessing.
      </p>

      <h2 className="mt-12 font-serif text-xl tracking-[-0.01em]">What it can retrieve</h2>
      <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Republic Acts with full text, Presidential Decrees, Executive Orders, Batas Pambansa,
        Commonwealth and Assembly Acts, the 1987 Constitution, and Supreme Court decisions with full
        text. Every answer is grounded in at least one tool result from this conversation.
      </p>

      <h2 className="mt-12 font-serif text-xl tracking-[-0.01em]">Legal sources</h2>
      <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Philippine statutes and judicial decisions are public domain under RA 8293, Section 176.
        The Hudika corpus is a curated subset of the BetterGov gov-library dataset, which was scraped
        from LawPhil. Each statute was verified against its own text before being indexed, so every
        citation points to a real, existing document.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {sources.map((s) => (
          <SiteLogo
            key={s.name}
            name={s.name}
            href={s.href}
            host={s.host}
            src={s.src}
            tagline={s.tagline}
            invertInDark={s.invertInDark}
            wideLogo={s.wideLogo}
          />
        ))}
      </div>

      <h2 className="mt-12 font-serif text-xl tracking-[-0.01em]">
        What Hudika is not
      </h2>
      <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Hudika gives general legal information, not legal advice. A Philippine-licensed attorney
        should review the specifics of your situation before you act on anything Hudika says.{" "}
        <Link href="/" className="text-foreground underline underline-offset-4">
          Return to the assistant
        </Link>
        .
      </p>
    </main>
  );
}