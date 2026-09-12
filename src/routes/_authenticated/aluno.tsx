import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, LogIn, MessageCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Minhas atividades — Trilha" },
      {
        name: "description",
        content: "Entre na turma com o código do professor e converse com o tutor pedagógico das atividades.",
      },
      { property: "og:title", content: "Minhas atividades — Trilha" },
      {
        property: "og:description",
        content: "Atividades abertas da turma, com o tutor de IA e o contador de perguntas restantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentHome,
});

type ActivityCard = {
  id: string;
  title: string;
  description: string;
  prompt_limit: number;
  is_open: boolean;
  className: string;
  used: number;
};

function StudentHome() {
  const { user, fullName } = useSession();
  const [activities, setActivities] = useState<ActivityCard[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function load() {
    const { data: memberships } = await supabase
      .from("class_members")
      .select("class_id, classes(name)");

    const names = (memberships ?? [])
      .map((row) => row.classes?.name)
      .filter((name): name is string => Boolean(name));
    setClassNames(names);

    const { data: rows } = await supabase
      .from("activities")
      .select("id, title, description, prompt_limit, is_open, class_id, classes(name)")
      .order("created_at", { ascending: false });

    const { data: usage } = await supabase.from("activity_usage").select("activity_id, used_count");
    const usedByActivity = new Map((usage ?? []).map((u) => [u.activity_id, u.used_count]));

    setActivities(
      (rows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        prompt_limit: row.prompt_limit,
        is_open: row.is_open,
        className: row.classes?.name ?? "",
        used: usedByActivity.get(row.id) ?? 0,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function joinClass(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setJoining(true);
    const normalized = code.trim().toUpperCase();
    const { data: found } = await supabase
      .from("classes")
      .select("id, name")
      .eq("code", normalized)
      .maybeSingle();

    if (!found) {
      const { error } = await supabase
        .from("class_members")
        .insert({ class_id: normalized, student_id: user.id })
        .select();
      void error;
      setJoining(false);
      toast.error("Código não encontrado", { description: "Confira o código com o professor." });
      return;
    }

    const { error } = await supabase
      .from("class_members")
      .insert({ class_id: found.id, student_id: user.id });
    setJoining(false);

    if (error && !error.message.includes("duplicate")) {
      toast.error("Não foi possível entrar na turma", { description: error.message });
      return;
    }
    setCode("");
    toast.success(`Você entrou em ${found.name}`);
    void load();
  }

  const hasClasses = classNames.length > 0;

  return (
    <AppShell
      title={`Olá, ${fullName.split(" ")[0] || "aluno"}`}
      subtitle={hasClasses ? `Turmas: ${classNames.join(", ")}` : "Entre na sua turma com o código do professor."}
      userName={fullName}
    >
      {!hasClasses ? (
        <form
          onSubmit={joinClass}
          className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 className="text-base font-semibold">Entrar em uma turma</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O professor compartilha um código de 6 caracteres.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="code">Código da turma</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="font-mono tracking-widest"
              required
            />
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <LogIn className="mr-1 h-4 w-4" />
                Entrar na turma
              </>
            )}
          </Button>
        </form>
      ) : null}

      <section className={hasClasses ? "" : "mt-8"}>
        <h2 className="mb-3 text-lg font-semibold">Atividades</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando atividades…
          </div>
        ) : activities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
            Nenhuma atividade por aqui ainda. Quando o professor abrir uma, ela aparece nesta lista.
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const remaining = Math.max(activity.prompt_limit - activity.used, 0);
              const blocked = remaining === 0 || !activity.is_open;
              return (
                <Link
                  key={activity.id}
                  to="/atividade/$activityId"
                  params={{ activityId: activity.id }}
                  className="block rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      {blocked ? <Lock className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.className}</p>
                      {activity.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {activity.description}
                        </p>
                      ) : null}
                      <p
                        className={`mt-3 text-sm font-semibold ${
                          blocked ? "text-muted-foreground" : "text-primary"
                        }`}
                      >
                        {!activity.is_open
                          ? "Atividade encerrada"
                          : `${remaining}/${activity.prompt_limit} perguntas restantes`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {hasClasses ? (
        <form onSubmit={joinClass} className="mt-8 flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="code-extra">Entrar em outra turma</Label>
            <Input
              id="code-extra"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Código"
              className="font-mono tracking-widest"
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={joining}>
            Entrar
          </Button>
        </form>
      ) : null}
    </AppShell>
  );
}
