"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function Topbar() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : systemPrefersDark
          ? "dark"
          : "light";

    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5 sm:px-6">
      <p className="font-serif text-lg leading-none tracking-tight">
        <Link href="/">Hudika</Link>
      </p>
      <div className="flex items-center gap-1">
        <Link
          href="/about"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "text-muted-foreground hover:text-foreground",
          })}
        >
          About
        </Link>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          <Moon className="size-4 dark:hidden" />
          <Sun className="size-4 hidden dark:block" />
        </Button>
      </div>
    </header>
  );
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
