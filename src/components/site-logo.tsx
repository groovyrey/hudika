"use client";

import { useState } from "react";

/**
 * A source card showing the site's real web logo in a theme-aware tile,
 * the site name, its visible source link, and a short description.
 */
export function SiteLogo(props: {
  name: string;
  href: string;
  host: string;
  src: string;
  tagline: string;
  invertInDark?: boolean;
  wideLogo?: boolean;
}) {
  const { name, href, host, src, tagline, invertInDark, wideLogo } = props;
  const [failed, setFailed] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-3 rounded-xl border border-border bg-background p-5 shadow-xs transition-all duration-150 hover:bg-muted/40 hover:shadow-sm active:translate-y-px"
    >
      <span className="flex items-start gap-3">
        <span
          className={`grid place-items-center overflow-hidden rounded-lg border border-border bg-muted/70 dark:bg-muted/70 ${
            wideLogo ? "h-11 min-w-14 px-2" : "size-11"
          }`}
        >
          {!failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={name}
              className={`max-h-7 w-auto object-contain ${
                invertInDark ? "dark:invert" : ""
              }`}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <span className="font-serif text-base font-semibold text-foreground">
              {name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-medium leading-snug text-foreground group-hover:underline">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground underline underline-offset-2">
            {host}
          </span>
        </span>
      </span>
      <span className="text-sm leading-snug text-muted-foreground">{tagline}</span>
    </a>
  );
}