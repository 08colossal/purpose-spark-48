import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/turma/$classId")({
  head: () => ({
    meta: [
      { title: "Turma — Trilha" },
      {
        name: "description",
        content: "Alunos, atividades com trava metacognitiva e dashboard de dúvidas da turma.",
      },
      { property: "og:title", content: "Turma — Trilha" },
      {
        property: "og:description",
        content: "Acompanhe engajamento, cotas de perguntas e dúvidas reais da sua turma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassPage,
});

type Activity = {
  id: string;
  title: string;
  description: string;
  prompt_limit: number;
  is_open: boolean;
  materialIds: string[];
};

type Student = { id: string; name: string };
type Question = { id: string; content: string; created_at: string; student_id: string; activity_id: string };
type Usage = { activity_id: string; student_id: string; used_count: number };

function ClassPage() {
  const { classId } = Route.useParams();
  const { user, fullName } = useSession();

  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [materials, setMaterials] = useState<{ id: string; title: string; is_active: boolean }[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function load() {
    const [{ data: klass }, { data: members }, { data: acts }, { data: mats }] = await Promise.all([
      supabase.from("classes").select("name, code").eq("id", classId).maybeSingle(),
      supabase.from("class_members").select("student_id, profiles(full_name)").eq("class_id", classId),
      supabase
        .from("activities")
        .select("id, title, description, prompt_limit, is_open, activity_materials(material_id)")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase.from("materials").select("id, title, is_active").order("created_at", { ascending: false }),
    ]);

    setClassName(klass?.name ?? "Turma");
    setClassCode(klass?.code ?? "");
    setStudents(
      (members ?? []).map((row) => ({
        id: row.student_id,
        name: row.profiles?.full_name || "Aluno",
      })),
    );
    const activityRows = (acts ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      prompt_limit: row.prompt_limit,
      is_open: row.is_open,
      materialIds: (row.activity_materials ?? []).map((m) => m.material_id),
    }));
    setActivities(activityRows);
    setMaterials(mats ?? []);

    const activityIds = activityRows.map((a) => a.id);
    if (activityIds.length > 0) {
      const [{ data: msgs }, { data: usageRows }] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id, content, created_at, student_id, activity_id")
          .in("activity_id", activityIds)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("activity_usage").select("activity_id, student_id, used_count").in("activity_id", activityIds),
      ]);
      setQuestions(msgs ?? []);
      setUsage(usageRows ?? []);
    } else {
      setQuestions([]);
      setUsage([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, classId]);

  async function createActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        class_id: classId,
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim(),
        prompt_limit: limit,
      })
      .select("id")
      .single();

    if (error || !data) {
      setCreating(false);
      toast.error("Não foi possível criar a atividade", { description: error?.message });
      return;
    }

    if (selected.length > 0) {
      await supabase
        .from("activity_materials")
        .insert(selected.map((materialId) => ({ activity_id: data.id, material_id: materialId })));
    }

    setCreating(false);
    setTitle("");
    setDescription("");
    setSelected([]);
    setLimit(5);
    toast.success("Atividade criada", { description: `Trava de ${limit} perguntas por aluno.` });
    void load();
  }

  async function toggleOpen(activity: Activity, next: boolean) {
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_open: next } : a)));
    const { error } = await supabase.from("activities").update({ is_open: next }).eq("id", activity.id);
    if (error) {
      toast.error("Não foi possível atualizar a atividade");
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_open: !next } : a)));
    }
  }

  const studentNames = new Map(students.map((s) => [s.id, s.name]));
  const activityTitles = new Map(activities.map((a) => [a.id, a.title]));
  const totalCapacity = activities.reduce((sum, a) => sum + a.prompt_limit * students.length, 0);
  const totalUsed = usage.reduce((sum, u) => sum + u.used_count, 0);
  const engagedStudents = new Set(usage.filter((u) => u.used_count > 0).map((u) => u.student_id)).size;
  const blockedCount = usage.filter((u) => {
    const activity = activities.find((a) => a.id === u.activity_id);
    return activity ? u.used_count >= activity.prompt_limit : false;
  }).length;
  const consumption = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  return (
    <AppShell
      wide
      title={className}
      subtitle={classCode ? `Código da turma: ${classCode}` : undefined}
      userName={fullName}
      nav={
        <Button asChild variant="ghost" size="sm">
          <Link to="/professor">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Painel
          </Link>
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando turma…
        </div>
      ) : (
        <Tabs defaultValue="atividades">
          <TabsList>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="duvidas">Dúvidas da turma</TabsTrigger>
            <TabsTrigger value="alunos">Alunos ({students.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="mt-5">
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                    Nenhuma atividade criada. Use o formulário ao lado para definir a primeira trava.
                  </p>
                ) : (
                  activities.map((activity) => {
                    const activityUsage = usage.filter((u) => u.activity_id === activity.id);
                    const used = activityUsage.reduce((sum, u) => sum + u.used_count, 0);
                    const capacity = activity.prompt_limit * Math.max(students.length, 1);
                    return (
                      <article
                        key={activity.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-40 flex-1">
                            <p className="font-semibold">{activity.title}</p>
                            {activity.description ? (
                              <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {activity.is_open ? "Aberta" : "Encerrada"}
                            <Switch
                              checked={activity.is_open}
                              onCheckedChange={(next) => void toggleOpen(activity, next)}
                              aria-label="Abrir ou encerrar atividade"
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Trava: {activity.prompt_limit} perguntas por aluno
                          </span>
                          <span>{activity.materialIds.length} materiais vinculados</span>
                          <span>
                            {used} de {capacity} perguntas usadas
                          </span>
                          <span>{activityUsage.length} alunos participaram</span>
                        </div>
                        <Progress value={capacity > 0 ? (used / capacity) * 100 : 0} className="mt-3 h-2" />
                      </article>
                    );
                  })
                )}
              </div>

              <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <h2 className="text-base font-semibold">Nova atividade</h2>
                <form className="mt-4 space-y-4" onSubmit={createActivity}>
                  <div className="space-y-2">
                    <Label htmlFor="activity-title">Título</Label>
                    <Input
                      id="activity-title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Lista 3 — Frações"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activity-description">Orientações para a turma</Label>
                    <Textarea
                      id="activity-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Resolva os exercícios 1 a 8 antes de perguntar ao tutor."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activity-limit">Trava metacognitiva (perguntas por aluno)</Label>
                    <Input
                      id="activity-limit"
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ao esgotar, o chat do aluno trava nesta atividade.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Materiais ativos para esta atividade</Label>
                    {materials.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum material enviado ainda —{" "}
                        <Link to="/materiais" className="text-primary hover:underline">
                          enviar PDFs
                        </Link>
                        .
                      </p>
                    ) : (
                      <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                        {materials.map((material) => (
                          <label key={material.id} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selected.includes(material.id)}
                              onChange={(e) =>
                                setSelected((prev) =>
                                  e.target.checked
                                    ? [...prev, material.id]
                                    : prev.filter((id) => id !== material.id),
                                )
                              }
                            />
                            <span>
                              {material.title}
                              {!material.is_active ? (
                                <span className="ml-1 text-xs text-muted-foreground">(inativo)</span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-1 h-4 w-4" />
                        Criar atividade
                      </>
                    )}
                  </Button>
                </form>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="duvidas" className="mt-5 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Perguntas feitas", value: String(totalUsed) },
                { label: "Alunos participando", value: `${engagedStudents}/${students.length}` },
                { label: "Cota consumida", value: `${consumption}%` },
                { label: "Travaram no limite", value: String(blockedCount) },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
                >
                  <p className="font-display text-2xl font-bold text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold">Perguntas dos alunos</h2>
              {questions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                  Nenhuma dúvida registrada ainda. Elas aparecem aqui assim que a turma começar a usar o
                  tutor.
                </p>
              ) : (
                <div className="space-y-2">
                  {questions.map((question) => (
                    <article key={question.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm">{question.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {studentNames.get(question.student_id) ?? "Aluno"} ·{" "}
                        {activityTitles.get(question.activity_id) ?? "Atividade"} ·{" "}
                        {new Date(question.created_at).toLocaleString("pt-BR")}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="alunos" className="mt-5">
            {students.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                Nenhum aluno entrou ainda. Compartilhe o código <strong>{classCode}</strong> com a turma.
              </p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const used = usage
                    .filter((u) => u.student_id === student.id)
                    .reduce((sum, u) => sum + u.used_count, 0);
                  return (
                    <article
                      key={student.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                    >
                      <span className="text-sm font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground">{used} perguntas feitas</span>
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
