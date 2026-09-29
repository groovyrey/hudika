"use client";

import { useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { Loader2, MessageSquare, RotateCcw, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UiChatMessage } from "./types";

export function ChatWidget(props: {
  onRestart: () => void;
  messages: UiChatMessage[];
  input: string;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  composerActions?: ReactNode;
}) {
  const {
    onRestart,
    messages,
    input,
    onInputChange,
    onSubmit,
    isLoading,
    error,
    onRetry,
    composerActions,
  } = props;

  const visibleMessages = messages.filter((m) => m.role !== "system");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [visibleMessages.length, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h1 className="font-heading truncate text-sm font-semibold tracking-tight">Hudika</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRestart}
          title="Restart conversation"
          aria-label="Restart conversation"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
          {visibleMessages.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
              <MessageSquare className="size-6 opacity-20" />
              <p className="text-sm text-muted-foreground">Ask a question to start.</p>
            </div>
          ) : (
            visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg p-3 text-sm break-words [overflow-wrap:anywhere] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div
                    className={`prose prose-sm max-w-full overflow-x-auto space-y-3 ${
                      msg.role === "user" ? "prose-invert dark:prose-neutral" : "dark:prose-invert"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && visibleMessages[visibleMessages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-lg">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm w-full">
                <strong>Error:</strong> {error.message || "An error occurred while fetching the response."}
                <Button
                  variant="link"
                  size="sm"
                  className="text-destructive h-auto p-0 ml-2"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          {composerActions}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isLoading}
            rows={1}
            className="max-h-40 resize-none"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="shrink-0"
            title="Send"
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
