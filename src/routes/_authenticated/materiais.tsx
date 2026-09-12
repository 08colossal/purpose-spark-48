import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { extractPdfText } from "@/lib/pdf-text";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/materiais")({
  head: () => ({
    meta: [
      { title: "Materiais da aula — Trilha" },
      {
        name: "description",
        content: "Envie PDFs de livro, listas e gabaritos e escolha quais ficam ativos para o tutor de IA.",
      },
      { property: "og:title", content: "Materiais da aula — Trilha" },
      {
        property: "og:description",
        content: "Biblioteca de PDFs do professor com controle de quais materiais a IA pode usar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});

type Material = {
  id: string;
  title: string;
  kind: string;
  page_count: number;
  is_active: boolean;
  content_text: string;
  file_path: string | null;
  created_at: string;
};

const kinds = [
  { value: "livro", label: "Livro / apostila" },
  { value: "lista", label: "Lista de exercícios" },
  { value: "gabarito", label: "Gabarito" },
  { value: "apoio", label: "Material de apoio" },
];

function MaterialsPage() {
  const { user, fullName } = useSession();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("livro");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("materials")
        .select("id, title, kind, page_count, is_active, content_text, file_path, created_at")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setMaterials(data ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !file) return;
    setUploading(true);
    try {
      const { text, pageCount } = await extractPdfText(file);
      if (!text.trim()) {
        toast.warning("Não encontramos texto neste PDF", {
          description: "Se ele for uma imagem digitalizada, o tutor não conseguirá ler o conteúdo.",
        });
      }

      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("materiais")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error } = await supabase
        .from("materials")
        .insert({
          teacher_id: user.id,
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
          kind,
          file_path: path,
          page_count: pageCount,
          content_text: text,
          is_active: true,
        })
        .select("id, title, kind, page_count, is_active, content_text, file_path, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Falha ao salvar o material.");

      setMaterials((prev) => [data, ...prev]);
      setTitle("");
      setFile(null);
      toast.success("Material enviado e pronto para a IA");
    } catch (error) {
      toast.error("Não foi possível enviar o material", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(material: Material, next: boolean) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === material.id ? { ...m, is_active: next } : m)),
    );
    const { error } = await supabase
      .from("materials")
      .update({ is_active: next })
      .eq("id", material.id);
    if (error) {
      toast.error("Não foi possível atualizar o material");
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, is_active: !next } : m)),
      );
    }
  }

  async function removeMaterial(material: Material) {
    const { error } = await supabase.from("materials").delete().eq("id", material.id);
    if (error) {
      toast.error("Não foi possível excluir o material");
      return;
    }
    if (material.file_path) {
      await supabase.storage.from("materiais").remove([material.file_path]);
    }
    setMaterials((prev) => prev.filter((m) => m.id !== material.id));
    toast.success("Material excluído");
  }

  return (
    <AppShell
      wide
      title="Materiais da aula"
      subtitle="Os materiais ativos são os únicos que o tutor pode usar nas atividades."
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
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando materiais…
            </div>
          ) : materials.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
              Nenhum material ainda. Envie um PDF ao lado — pode ser o capítulo do livro, a lista de
              exercícios ou o gabarito.
            </p>
          ) : (
            materials.map((material) => (
              <article
                key={material.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">{material.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {kinds.find((k) => k.value === material.kind)?.label ?? material.kind} ·{" "}
                    {material.page_count} páginas ·{" "}
                    {material.content_text.length > 0
                      ? `${Math.round(material.content_text.length / 1000)} mil caracteres lidos`
                      : "sem texto legível"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {material.is_active ? "Ativo para a IA" : "Inativo"}
                  </span>
                  <Switch
                    checked={material.is_active}
                    onCheckedChange={(next) => void toggleActive(material, next)}
                    aria-label="Ativar material para a IA"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeMaterial(material)}
                    aria-label="Excluir material"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Enviar PDF</h2>
          <form className="mt-4 space-y-4" onSubmit={handleUpload}>
            <div className="space-y-2">
              <Label htmlFor="material-title">Título</Label>
              <Input
                id="material-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Capítulo 4 — Frações"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-kind">Tipo</Label>
              <select
                id="material-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {kinds.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-file">Arquivo PDF</Label>
              <Input
                id="material-file"
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={uploading || !file}>
              {uploading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Lendo o PDF…
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" />
                  Enviar material
                </>
              )}
            </Button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
