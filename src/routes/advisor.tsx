import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, BrainCircuit } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Disclaimer, InlineChart, type ChartSpec } from "@/components/kudi";

function KudiMarkdown({ text }: { text: string }) {
  const parts = text.split(/```chart\s*([\s\S]*?)```/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 1) {
          try {
            return <InlineChart key={i} spec={JSON.parse(p) as ChartSpec} />;
          } catch {
            return null;
          }
        }
        // hide a half-streamed chart block
        const clean = p.replace(/```chart[\s\S]*$/, "");
        return clean.trim() ? <ReactMarkdown key={i}>{clean}</ReactMarkdown> : null;
      })}
    </>
  );
}

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "Ask Kudi — KudiLens" },
      {
        name: "description",
        content: "Ask an AI analyst about your debts, investments and family finances, grounded in your own numbers.",
      },
      { property: "og:title", content: "Ask Kudi — KudiLens" },
      { property: "og:description", content: "Personal, data-driven financial advice from your own records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdvisorPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const starters = [
  "Can I afford a ₦15m car next year?",
  "Should I roll over my T-bill or put it in a money market fund?",
  "What happens if I have another child in 2 years?",
  "Should I pay off debt or invest first?",
];

function AdvisorPage() {
  return (
    <AppShell>
      <Chat />
    </AppShell>
  );
}

function Chat() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("advisor_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Msg[]));
    inputRef.current?.focus();
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !session) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last) copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Something went wrong.";
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
        return copy;
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      <div className="flex gap-2 overflow-x-auto pb-3">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto pb-6">
        {messages.length === 0 && (
          <div className="pt-10 text-center">
            <BrainCircuit className="mx-auto size-10 text-primary" />
            <h1 className="mt-4 text-2xl font-semibold">Ask Kudi</h1>
            <p className="mt-2 text-muted-foreground">
              I read everything in “My numbers” before answering. Ask anything.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="panel p-3 text-left text-sm transition-colors hover:border-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <BrainCircuit className="mt-1 size-5 shrink-0 text-primary" />
              <div className="prose prose-invert prose-sm min-w-0 max-w-none text-foreground [&_li]:my-0.5 [&_h3]:mt-3 [&_strong]:text-foreground">
                {m.content ? (
                  <KudiMarkdown text={m.content} />
                ) : (
                  <span className="animate-pulse text-muted-foreground">Analysing your numbers…</span>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="panel flex items-end gap-2 p-2"
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about your debts, investments, family plans…"
          className="min-h-[44px] resize-none border-0 bg-transparent focus-visible:ring-0"
          rows={1}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} className="shrink-0">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      <div className="pt-2 text-center">
        <Disclaimer />
      </div>
    </div>
  );
}
