"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { ChevronRight, Scale, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCitationsFromMessage, type Citation } from "@/lib/citations";
import { CitationsModal } from "./citations-modal";
import { SourceModal } from "./source-modal";
import type { UiChatMessage } from "./types";

const LAST_WORD_RE = /\S+$/;

function WordStream({ text, live }: { text: string; live: boolean }) {
  if (!live) return <>{text}</>;

  const last = LAST_WORD_RE.exec(text);
  if (!last) return <>{text}</>;

  return (
    <>
      {text.slice(0, last.index)}
      <span className="stream-word">{last[0]}</span>
    </>
  );
}

function streamText(children: ReactNode, live: boolean): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <WordStream text={String(child)} live={live} />;
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      const kids = child.props.children;
      if (kids !== undefined && kids !== null) {
        return cloneElement(child, undefined, streamText(kids, live));
      }
    }
    return child;
  });
}

type StreamBlockProps = { children?: ReactNode; node?: unknown };

function streamBlock(Tag: React.ElementType, live: boolean) {
  return function StreamBlock({ children, node, ...props }: StreamBlockProps) {
    void node;
    return <Tag {...props}>{streamText(children, live)}</Tag>;
  };
}

function makeMarkdownComponents(live: boolean): Components {
  return {
    p: streamBlock("p", live),
    li: streamBlock("li", live),
    h1: streamBlock("h1", live),
    h2: streamBlock("h2", live),
    h3: streamBlock("h3", live),
    h4: streamBlock("h4", live),
    h5: streamBlock("h5", live),
    h6: streamBlock("h6", live),
    blockquote: streamBlock("blockquote", live),
    th: streamBlock("th", live),
    td: streamBlock("td", live),
    pre: ({ children }) => <pre>{children}</pre>,
  };
}

function sanitizeReasoning(text: string) {
  return text
    .replace(/^[ \t]*```.*$/gm, "")
    .replace(/^ {4,}/gm, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/`/g, "\\`");
}

function ReasoningBlock({ reasoning, streaming }: { reasoning: string; streaming: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  const source = useMemo(() => sanitizeReasoning(reasoning), [reasoning]);
  const components = useMemo(() => makeMarkdownComponents(streaming), [streaming]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [source, streaming]);

  if (reasoning.length === 0) return null;

  const open = override ?? streaming;

  return (
    <div className="mb-6">
      <div className="overflow-hidden rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setOverride(!open)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-150",
              open && "rotate-90"
            )}
          />
          <span className="text-xs font-medium tracking-[0.02em] text-foreground">
            {streaming ? "Thinking" : "Reasoning"}
          </span>
          {streaming && <span className="stream-caret" aria-hidden="true" />}
        </button>
        {open && (
          <div
            ref={scrollRef}
            className="reading max-h-80 overflow-y-auto border-t border-border px-3.5 py-3 text-[0.875rem] leading-relaxed text-muted-foreground"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {source}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingSkeleton() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>Thinking</span>
        <span className="stream-caret" aria-hidden="true" />
      </div>
      <div className="space-y-2.5" aria-hidden="true">
        <div className="h-3 w-full rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-[85%] rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-[45%] rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  );
}

const AssistantMessage = memo(function AssistantMessage({
  msg,
  streaming,
}: {
  msg: UiChatMessage;
  streaming: boolean;
}) {
  const components = useMemo(() => makeMarkdownComponents(streaming), [streaming]);
  const citations = useMemo(() => getCitationsFromMessage(msg), [msg]);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [inlineSource, setInlineSource] = useState<Citation | null>(null);

  return (
    <div className="w-full min-w-0 break-words [overflow-wrap:anywhere]">
      <ReasoningBlock reasoning={msg.reasoning ?? ""} streaming={streaming} />
      <div className="reading max-w-full overflow-x-auto dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {msg.content}
        </ReactMarkdown>
      </div>

      {streaming && msg.content && (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[0.6875rem] font-medium tracking-[0.02em] text-muted-foreground">
          <span className="stream-caret" aria-hidden="true" />
          Writing response
        </div>
      )}

      {citations.length > 0 && (
        <div className="mt-5 flex justify-start">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-input px-3 text-[0.8125rem] font-normal"
            onClick={() => setCitationsOpen(true)}
            title="See the sources this answer was based on"
            aria-label="See cited sources"
          >
            <Scale className="mr-2 size-3.5" />
            Cited sources ({citations.length})
          </Button>
        </div>
      )}

      {citationsOpen && (
        <CitationsModal
          citations={citations}
          onClose={() => setCitationsOpen(false)}
          onOpenSource={(citation) => setInlineSource(citation)}
        />
      )}

      {inlineSource && inlineSource.url && (
        <SourceModal
          result={{
            name: inlineSource.label,
            url: inlineSource.url,
            snippet: inlineSource.title,
          }}
          onClose={() => setInlineSource(null)}
        />
      )}
    </div>
  );
});

const UserMessage = memo(function UserMessage({ msg }: { msg: UiChatMessage }) {
  return (
    <div className="max-w-[30rem] rounded-2xl rounded-br-md bg-primary px-5 py-3.5 text-primary-foreground shadow-xs">
      <p className="text-[0.9375rem] leading-relaxed break-words [overflow-wrap:anywhere]">
        {msg.content}
      </p>
    </div>
  );
});

export function ChatWidget(props: {
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

  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const assistantHasNoOutput =
    (lastMessage?.role === "assistant" &&
      lastMessage.content.length === 0 &&
      (lastMessage.reasoning ?? "").length === 0) ??
    false;
  const isAwaitingFirstToken =
    isLoading &&
    (!lastMessage || lastMessage.role !== "assistant" || assistantHasNoOutput);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [visibleMessages.length, lastMessage?.content.length, lastMessage?.reasoning?.length, isLoading]);

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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 px-6 py-12 sm:px-8">
          {visibleMessages.length === 0 ? (
            <div className="flex min-h-[50vh] items-center">
              <p className="font-serif text-3xl leading-tight tracking-[-0.02em] text-muted-foreground">
                Ask a question.
              </p>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              if (
                msg.role === "assistant" &&
                msg.content.length === 0 &&
                (msg.reasoning ?? "").length === 0
              ) {
                return null;
              }
              return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "flex min-w-0 flex-col",
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start w-full"
                  )}
                >
                  <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {msg.role === "user" ? "You" : "Hudika AI"}
                  </p>
                  {msg.role === "user" ? (
                    <UserMessage msg={msg} />
                  ) : (
                    <AssistantMessage
                      msg={msg}
                      streaming={isLoading && msg.id === lastMessage?.id}
                    />
                  )}
                </div>
              </div>
              );
            })
          )}

          {isAwaitingFirstToken && <PendingSkeleton />}

          {error && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-destructive shadow-xs">
              <p>{error.message || "An error occurred while fetching the response."}</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto w-max p-0 text-destructive"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t border-border">
        <div className="mx-auto w-full max-w-[46rem] px-6 py-5 sm:px-8">
          <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-card p-2 pl-3 shadow-sm transition-colors focus-within:border-ring/70 focus-within:ring-1 focus-within:ring-ring/60">
            {composerActions}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question"
              disabled={isLoading}
              rows={1}
              className="max-h-40 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-[0.9375rem] shadow-none focus-visible:ring-0 focus-visible:outline-none dark:placeholder:text-muted-foreground/70"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
              className="size-9 shrink-0"
              title="Send"
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
