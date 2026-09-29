"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
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
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="font-heading text-lg font-bold tracking-tight transition-opacity hover:opacity-70"
          >
            Hudika
          </Link>

          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            <Moon className="size-4 dark:hidden" />
            <Sun className="size-4 hidden dark:block" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
