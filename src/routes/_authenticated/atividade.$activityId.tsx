import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Lock, Send, Sparkle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { askTutor } from "@/lib/tutor.functions";

export const Route = createFileRoute("/_authenticated/atividade/$activityId")({
  head: () => ({
    meta: [
      { title: "Tutor da atividade — Trilha" },
      {
        name: "description",
        content: "Converse com o tutor pedagógico da atividade com o contador de perguntas restantes.",
      },
      { property: "og:title", content: "Tutor da atividade — Trilha" },
      {
        property: "og:description",
        content: "Chat com tutor de IA baseado nos materiais da aula, com trava de perguntas por atividade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorChat,
});

type Message = { id: string; role: string; content: string };

function TutorChat() {
  const { activityId } = Route.useParams();
  const ask = useServerFn(askTutor);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [title, setTitle] = useState("Atividade");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [limit, setLimit] = useState(0);
  const [used, setUsed] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: activity }, { data: msgs }, { data: usage }] = await Promise.all([
        supabase
          .from("activities")
          .select("title, description, prompt_limit, is_open")
          .eq("id", activityId)
          .maybeSingle(),
        supabase
          .from("chat_messages")
          .select("id, role, content")
          .eq("activity_id", activityId)
          .order("created_at", { ascending: true }),
        supabase.from("activity_usage").select("used_count").eq("activity_id", activityId).maybeSingle(),
      ]);

      if (cancelled) return;
      setTitle(activity?.title ?? "Atividade");
      setDescription(activity?.description ?? "");
      setIsOpen(activity?.is_open ?? false);
      setLimit(activity?.prompt_limit ?? 0);
      setUsed(usage?.used_count ?? 0);
      setMessages(msgs ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const remaining = Math.max(limit - used, 0);
  const blocked = !isOpen || remaining === 0;

  useEffect(() => {
    if (!blocked && !loading) inputRef.current?.focus();
  }, [blocked, loading, sending]);

  async function send() {
    const text = question.trim();
    if (!text || blocked || sending) return;

    setSending(true);
    setQuestion("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text }]);

    try {
      const result = await ask({ data: { activityId, question: text } });
      setMessages((prev) => [
        ...prev,
        { id: `${optimisticId}-a`, role: "assistant", content: result.answer },
      ]);
      setUsed(result.used);
      setLimit(result.limit);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setQuestion(text);
      toast.error("O tutor não respondeu", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link to="/aluno" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">Tutor pedagógico</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className={remaining === 0 ? "text-destructive" : "text-primary"}>
                {remaining}/{limit} perguntas restantes
              </span>
              {!isOpen ? <span className="text-muted-foreground">atividade encerrada</span> : null}
            </div>
            <Progress value={limit > 0 ? (remaining / limit) * 100 : 0} className="mt-2 h-2" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
          </div>
        ) : (
          <div className="space-y-4">
            {description ? (
              <div className="rounded-2xl border border-accent/40 bg-accent/15 p-4 text-sm">
                <p className="font-semibold text-accent-foreground">Orientações do professor</p>
                <p className="mt-1 text-accent-foreground/90">{description}</p>
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                <Sparkle className="mb-2 h-5 w-5 text-primary" />
                Tente resolver primeiro e traga uma dúvida específica. Cada pergunta consome uma da sua
                cota, então vale pensar antes de escrever.
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div key={message.id} className="max-w-[95%]">
                    <p className="mb-1 text-xs font-semibold text-primary">Tutor</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                  </div>
                ),
              )
            )}

            {sending ? (
              <p className="animate-pulse text-sm text-muted-foreground">O tutor está pensando…</p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {blocked ? (
            <div className="flex items-start gap-2 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {!isOpen
                  ? "O professor encerrou esta atividade. O histórico continua disponível para releitura."
                  : "Você usou todas as perguntas desta atividade. Releia as respostas acima — a cota volta em uma nova atividade."}
              </p>
            </div>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Escreva sua dúvida com detalhes…"
                rows={2}
                disabled={sending}
                className="resize-none"
              />
              <Button type="submit" size="icon" disabled={sending || question.trim().length < 2}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Enviar pergunta</span>
              </Button>
            </form>
          )}
        </div>
      </footer>
    </div>
  );
}
