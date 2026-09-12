# Hacktudo 2026 — Plataforma Educacional com Propósito

Plataforma com duas áreas: painel do professor e área do aluno (mobile-first), com tutor de IA que usa os materiais da aula e uma cota de perguntas por atividade.

## Como vai funcionar

**Entrada**
- Página inicial apresentando a proposta, com botão de entrar/criar conta.
- Cadastro com e-mail e senha, escolhendo o perfil: professor ou aluno.
- Aluno entra em uma turma usando um código curto que o professor compartilha.

**Painel do professor**
- Criar turmas (com código de acesso) e ver quem entrou.
- Enviar PDFs (livro, lista de perguntas, gabarito) e marcar quais ficam ativos para a IA.
- Criar atividades: título, materiais ativos vinculados e a Trava Metacognitiva — o limite de perguntas por aluno naquela atividade (ex.: 5). Cada atividade tem cota própria; ao esgotar, o aluno só volta a perguntar em uma nova atividade.
- Abrir/fechar atividade para a turma.
- Dashboard de dúvidas: perguntas reais dos alunos, temas mais recorrentes, quantos alunos participaram, média de perguntas usadas, % de cota consumida e alunos que travaram no limite.

**Área do aluno (mobile-first)**
- Lista de atividades abertas da turma.
- Chat com o tutor pedagógico, que conduz por raciocínio em vez de entregar a resposta pronta, apoiado no conteúdo dos materiais ativos sem ficar preso a eles.
- Contador sempre visível: "3/5 perguntas restantes", com barra de progresso.
- Ao esgotar a cota, o campo de texto e o botão de envio ficam desativados, com mensagem explicando que o limite daquela atividade acabou. O histórico continua visível para releitura.

## Design

Direção moderna e educativa: fundo claro com uma cor de marca (verde-petróleo) e acento âmbar, tipografia com peso e cantos suaves, cartões com sombra leve. Painel do professor em grade densa de desktop; área do aluno em layout de coluna única com barra fixa de cota e composer no rodapé. Tudo por tokens semânticos do tema, sem cores fixas no código.

## Detalhes técnicos

- Lovable Cloud para banco, autenticação (e-mail/senha) e armazenamento dos PDFs.
- Tabelas: `profiles`, `user_roles` (professor/aluno, em tabela separada), `classes`, `class_members`, `materials`, `activities`, `activity_materials`, `chat_messages`, `activity_usage` (contador por aluno+atividade). RLS em todas: professor só acessa as próprias turmas; aluno só as turmas em que está e as próprias mensagens.
- Extração do texto dos PDFs no envio, guardada por material para alimentar o tutor.
- Chat via Lovable AI (streaming), em rota de servidor. A cota é verificada e incrementada no servidor antes de cada resposta — o bloqueio na tela é reforço visual, não a regra.
- Rotas: `/` pública; `/auth`; área protegida com `/professor/*` e `/aluno/*`; cada página com seu próprio título e descrição.

## Ordem de construção

1. Cloud + autenticação + perfis/papéis + banco com RLS.
2. Página inicial e login, tema visual e navegação por papel.
3. Painel do professor: turmas, upload/ativação de PDFs, atividades com trava.
4. Área do aluno: atividades, chat com IA, contador e bloqueio.
5. Dashboard de dúvidas e métricas de engajamento.
6. Dados de exemplo para demonstrar no hackathon.
