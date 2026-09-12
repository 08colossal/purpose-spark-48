import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskInput = z.object({
  activityId: z.string().uuid(),
  question: z.string().min(2).max(2000),
});

export type AskResult = {
  answer: string;
  used: number;
  limit: number;
};

const SYSTEM_PROMPT = `Você é um tutor pedagógico de uma plataforma escolar brasileira.
Sua missão é desenvolver o raciocínio do aluno, não entregar respostas prontas.

Regras:
- Responda sempre em português do Brasil, com linguagem clara e acolhedora.
- Use o material da aula fornecido como referência principal, citando de onde vem a ideia quando fizer sentido. O material pode conter enunciados, trechos de livro ou gabaritos: use-os como apoio, sem ficar preso a eles nem copiar gabarito.
- Nunca entregue a resposta final de um exercício de forma direta. Explique o conceito, dê um exemplo parecido e proponha o próximo passo do raciocínio.
- Cada pergunta do aluno é limitada, então seja completo e objetivo numa única resposta: explique o conceito, mostre o caminho e termine com uma pergunta que o faça pensar.
- Use formatação simples com parágrafos curtos e listas quando ajudar.`;

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<AskResult> => {
    const { supabase, userId } = context;

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, title, description, prompt_limit, is_open, class_id")
      .eq("id", data.activityId)
      .maybeSingle();

    if (activityError) throw new Error("Não foi possível carregar a atividade.");
    if (!activity) throw new Error("Atividade não encontrada para esta turma.");
    if (!activity.is_open) throw new Error("Esta atividade está encerrada pelo professor.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usage } = await supabaseAdmin
      .from("activity_usage")
      .select("used_count")
      .eq("activity_id", activity.id)
      .eq("student_id", userId)
      .maybeSingle();

    const used = usage?.used_count ?? 0;
    if (used >= activity.prompt_limit) {
      throw new Error("Você já usou todas as perguntas desta atividade.");
    }

    const { data: linked } = await supabaseAdmin
      .from("activity_materials")
      .select("materials(title, kind, content_text, is_active)")
      .eq("activity_id", activity.id);

    const materialText = (linked ?? [])
      .map((row) => row.materials)
      .filter((m): m is NonNullable<typeof m> => Boolean(m && m.is_active))
      .map((m) => `### ${m.title} (${m.kind})\n${m.content_text.slice(0, 14000)}`)
      .join("\n\n")
      .slice(0, 45000);

    const { data: history } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("activity_id", activity.id)
      .eq("student_id", userId)
      .order("created_at", { ascending: true })
      .limit(20);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A IA não está configurada neste projeto.");

    const contextBlock = materialText
      ? `Material ativo da atividade "${activity.title}":\n\n${materialText}`
      : `A atividade "${activity.title}" não tem material anexado. Apoie-se no conhecimento geral da disciplina.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: contextBlock },
          ...(history ?? []).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("AI gateway error", response.status, body);
      if (response.status === 429) {
        throw new Error("O tutor está recebendo muitas perguntas agora. Tente em alguns segundos.");
      }
      if (response.status === 402 || response.status === 403) {
        throw new Error("Os créditos de IA da plataforma acabaram. Fale com quem administra a conta.");
      }
      throw new Error("O tutor não conseguiu responder agora. Tente novamente.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("O tutor não conseguiu formular uma resposta. Tente reformular.");

    const nextUsed = used + 1;

    await supabaseAdmin.from("chat_messages").insert([
      { activity_id: activity.id, student_id: userId, role: "user", content: data.question },
      { activity_id: activity.id, student_id: userId, role: "assistant", content: answer },
    ]);

    await supabaseAdmin
      .from("activity_usage")
      .upsert(
        {
          activity_id: activity.id,
          student_id: userId,
          used_count: nextUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "activity_id,student_id" },
      );

    return { answer, used: nextUsed, limit: activity.prompt_limit };
  });
