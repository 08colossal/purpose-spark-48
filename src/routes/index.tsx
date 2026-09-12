import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenCheck, Brain, GaugeCircle, GraduationCap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trilha — Tutor de IA com trava metacognitiva para sala de aula" },
      {
        name: "description",
        content:
          "Plataforma educacional do Hackathon Hacktudo 2026: o professor escolhe os materiais, define quantas perguntas cada aluno pode fazer e acompanha as dúvidas da turma.",
      },
      { property: "og:title", content: "Trilha — Tecnologia com propósito na educação" },
      {
        property: "og:description",
        content:
          "Tutor pedagógico de IA baseado nos materiais da aula, com limite de perguntas por atividade e painel de dúvidas para o professor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: BookOpenCheck,
    title: "Materiais que o professor controla",
    text: "PDFs de livro, listas e gabaritos entram na plataforma e o professor decide quais ficam ativos para a IA em cada atividade.",
  },
  {
    icon: ShieldCheck,
    title: "Trava metacognitiva",
    text: "Cada atividade tem um número de perguntas por aluno. Ao esgotar, o chat trava — o aluno precisa pensar antes de perguntar.",
  },
  {
    icon: Brain,
    title: "Tutor que ensina o caminho",
    text: "O tutor conduz o raciocínio com base no material da aula em vez de entregar a resposta pronta.",
  },
  {
    icon: GaugeCircle,
    title: "Dúvidas da turma em um painel",
    text: "O professor vê as perguntas reais, quem participou, quanto da cota foi usada e quem travou no limite.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-base font-semibold leading-none">Trilha</p>
          <p className="text-xs text-muted-foreground">Hacktudo 2026</p>
        </div>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-14 pt-8 sm:pt-14">
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          Tecnologia com propósito e educação
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
          IA na sala de aula com limite, material da aula e olhar do professor.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          O professor sobe os materiais, define a trava metacognitiva de cada atividade e acompanha as
          dúvidas da turma. O aluno conversa com um tutor pedagógico no celular, com o contador de
          perguntas sempre à vista.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Criar conta de professor</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Sou aluno, tenho um código</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-2">
        {pillars.map((pillar) => (
          <article
            key={pillar.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <pillar.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{pillar.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pillar.text}</p>
          </article>
        ))}
      </section>

      <section className="border-t border-border bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:grid-cols-3">
          <div>
            <p className="font-display text-3xl font-bold text-primary">1</p>
            <h3 className="mt-2 text-base font-semibold">Professor cria a turma</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Um código curto é gerado e compartilhado com os alunos.
            </p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-primary">2</p>
            <h3 className="mt-2 text-base font-semibold">Materiais e trava</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              PDFs ativos e o limite de perguntas por aluno em cada atividade.
            </p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-primary">3</p>
            <h3 className="mt-2 text-base font-semibold">Aluno conversa e pensa</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Chat mobile-first com contador visível e bloqueio automático.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted-foreground">
        Projeto criado para o Hackathon Hacktudo 2026.
      </footer>
    </div>
  );
}
