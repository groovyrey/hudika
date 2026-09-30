"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspaceRail({ onRestart }: { onRestart: () => void }) {
  return (
    <aside className="hidden w-48 shrink-0 flex-col border-r border-border px-6 py-7 md:flex">
      <nav>
        <Button
          variant="link"
          onClick={onRestart}
          className="h-auto gap-2 p-0 text-sm font-normal text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          New
        </Button>
      </nav>
    </aside>
  );
}
