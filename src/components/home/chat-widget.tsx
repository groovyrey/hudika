"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { ChevronRight, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

  if (reasoning.length === 0) return null;

  const open = override ?? streaming;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOverride(!open)}
        className="group inline-flex items-center gap-1.5 text-xs tracking-[0.02em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
        />
        {streaming ? "Thinking" : "Reasoning"}
      </button>
      {open && (
        <div className="reading mt-3 max-w-full overflow-x-auto border-l border-border pl-5 text-[0.9375rem] text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {source}
          </ReactMarkdown>
        </div>
      )}
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

  return (
    <div className="max-w-full break-words [overflow-wrap:anywhere]">
      <ReasoningBlock reasoning={msg.reasoning ?? ""} streaming={streaming} />
      <div className="reading max-w-full overflow-x-auto dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {msg.content}
        </ReactMarkdown>
      </div>
    </div>
  );
});

const UserMessage = memo(function UserMessage({ msg }: { msg: UiChatMessage }) {
  return (
    <p className="max-w-[42rem] font-serif text-[1.3125rem] leading-[1.35] tracking-[-0.01em] break-words [overflow-wrap:anywhere]">
      {msg.content}
    </p>
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
  const isAwaitingFirstToken =
    isLoading && (!lastMessage || lastMessage.role !== "assistant" || lastMessage.content.length === 0);

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
        <div className="mx-auto w-full max-w-[46rem] px-6 py-12 sm:px-8">
          {visibleMessages.length === 0 ? (
            <div className="flex min-h-[50vh] items-center">
              <p className="font-serif text-3xl leading-tight tracking-[-0.02em] text-muted-foreground">
                Ask a question.
              </p>
            </div>
          ) : (
            visibleMessages.map((msg, i) => (
              <div
                key={msg.id}
                className={cn(
                  "border-t border-border pt-6 pb-10 first:border-t-0 first:pt-0",
                  i > 0 && "mt-2"
                )}
              >
                <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
            ))
          )}

          {isAwaitingFirstToken && (
            <div className="flex items-center gap-2 border-t border-border pt-8 text-sm text-muted-foreground">
              <span>Thinking</span>
              <span className="stream-caret" aria-hidden="true" />
            </div>
          )}

          {error && (
            <div className="border-t border-border pt-8 text-sm text-destructive">
              <p>{error.message || "An error occurred while fetching the response."}</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
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
        <div className="mx-auto flex w-full max-w-[46rem] items-end gap-3 px-6 py-5 sm:px-8">
          {composerActions}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question"
            disabled={isLoading}
            rows={1}
            className="max-h-40 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[0.9375rem] shadow-none focus-visible:ring-0 focus-visible:outline-none dark:placeholder:text-muted-foreground/70"
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
      </form>
    </div>
  );
}
