import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Copy, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/professor")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Trilha" },
      {
        name: "description",
        content: "Crie turmas, gerencie materiais em PDF e configure a trava metacognitiva das atividades.",
      },
      { property: "og:title", content: "Painel do professor — Trilha" },
      {
        property: "og:description",
        content: "Turmas, materiais ativos, atividades com limite de perguntas e dúvidas da turma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherHome,
});

type ClassRow = {
  id: string;
  name: string;
  subject: string;
  code: string;
  created_at: string;
};

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function TeacherHome() {
  const { user, role, fullName, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { students: number; activities: number }>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!sessionLoading && role === "aluno") void navigate({ to: "/aluno" });
  }, [role, sessionLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("classes")
        .select("id, name, subject, code, created_at")
        .order("created_at", { ascending: false });
      const rows = data ?? [];

      const [members, activities] = await Promise.all([
        supabase.from("class_members").select("class_id"),
        supabase.from("activities").select("class_id"),
      ]);

      const tally: Record<string, { students: number; activities: number }> = {};
      for (const row of rows) tally[row.id] = { students: 0, activities: 0 };
      for (const m of members.data ?? []) {
        if (tally[m.class_id]) tally[m.class_id].students += 1;
      }
      for (const a of activities.data ?? []) {
        if (tally[a.class_id]) tally[a.class_id].activities += 1;
      }

      if (cancelled) return;
      setClasses(rows);
      setCounts(tally);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setCreating(true);
    const code = randomCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: user.id, name: name.trim(), subject: subject.trim(), code })
      .select("id, name, subject, code, created_at")
      .single();
    setCreating(false);

    if (error || !data) {
      toast.error("Não foi possível criar a turma", { description: error?.message });
      return;
    }
    setClasses((prev) => [data, ...prev]);
    setCounts((prev) => ({ ...prev, [data.id]: { students: 0, activities: 0 } }));
    setName("");
    setSubject("");
    toast.success("Turma criada", { description: `Código de acesso: ${data.code}` });
  }

  return (
    <AppShell
      wide
      title="Painel do professor"
      subtitle="Turmas, materiais e a trava metacognitiva de cada atividade."
      userName={fullName}
      nav={
        <Button asChild variant="outline" size="sm">
          <Link to="/materiais">
            <BookOpen className="mr-1 h-4 w-4" />
            Materiais
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Suas turmas</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando turmas…
            </div>
          ) : classes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
              Você ainda não tem turmas. Crie a primeira ao lado e compartilhe o código com os alunos.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {classes.map((row) => (
                <Link
                  key={row.id}
                  to="/turma/$classId"
                  params={{ classId: row.id }}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary"
                >
                  <p className="text-base font-semibold">{row.name}</p>
                  <p className="text-sm text-muted-foreground">{row.subject || "Sem disciplina"}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {counts[row.id]?.students ?? 0} alunos
                    </span>
                    <span>{counts[row.id]?.activities ?? 0} atividades</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                    <span className="font-mono text-sm font-semibold tracking-widest text-secondary-foreground">
                      {row.code}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={(event) => {
                        event.preventDefault();
                        void navigator.clipboard.writeText(row.code);
                        toast.success("Código copiado");
                      }}
                    >
                      <Copy className="mr-1 inline h-3.5 w-3.5" />
                      copiar
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Nova turma</h2>
          <form className="mt-4 space-y-4" onSubmit={createClass}>
            <div className="space-y-2">
              <Label htmlFor="class-name">Nome da turma</Label>
              <Input
                id="class-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="9º ano B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-subject">Disciplina</Label>
              <Input
                id="class-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Matemática"
              />
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-1 h-4 w-4" />
                  Criar turma
                </>
              )}
            </Button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
