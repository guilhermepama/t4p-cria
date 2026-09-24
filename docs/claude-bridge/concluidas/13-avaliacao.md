# Tarefa 13 — Avaliação do curso (fim da Aula 1 e fim da Aula 3)

**Status: CONCLUÍDA**

- Tipo: código (db + rotas + snippet nas aulas 1 e 3 + /aluno + /admin + e2e). Sem dependência nova.
- Data: 23/09/2026
- Base: tarefas 01–12 concluídas e mergeadas (`origin/main` em `f85188d`, PR #12).
- Antes de criar a branch: a working tree está na `tarefa/12-render-mobile` com esta tarefa e `concluidas/12-render-mobile.md` alterados/não versionados. Faça `git checkout main && git pull`, leve os dois arquivos, crie `tarefa/13-avaliacao` e faça primeiro o commit `docs: planejador — tarefa 13`.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, CSV de vendas. Migração **só aditiva** (tabela nova).

## Objetivo

Saber o que os alunos estão achando do curso, com nota e comentário, e ter isso no /admin antes do pitch de sexta (08:20). Os comentários com autorização viram depoimento real para o pitch de impacto e a divulgação.

## Decisões de produto que não mudam

- **Duas avaliações, mesma escala (nota 1 a 5):**
  - `intermediaria` — no fim da **Aula 1** (não da Aula 2). A Aula 1 é a que mais gente vai concluir até sexta; é ali que sai volume de resposta a tempo.
  - `final` — no fim da **Aula 3**.
- **Onde aparece:** principal = dentro da tela final da própria aula (é onde o aluno está no fim; da Aula 1 ele segue direto para a Aula 2 e não volta ao /aluno). Reserva = cartão no /aluno para quem concluiu e não respondeu.
- Comentário **opcional**. Nota obrigatória.
- Autorização de divulgação: caixa **desmarcada** por padrão. Sem ela, o comentário nunca sai do /admin.
- Uma resposta por aluno por etapa. Reenviar **sobrescreve** (upsert). Sem histórico.
- Não exigir aula concluída no servidor para aceitar a avaliação (se o POST de progresso falhou em silêncio, a avaliação não pode dar 400 por isso).

## Textos (usar exatamente)

**Intermediária (fim da Aula 1)**
- Título: `O que você está achando do curso até aqui?`
- Escala: botões `1` a `5`, com legenda abaixo: `1 = não gostei` à esquerda, `5 = gostei muito` à direita.
- Campo: rótulo `Quer contar mais? (opcional)`, placeholder `O que ajudou, o que ficou confuso, o que faltou…`
- Caixa: `Pode usar meu comentário, com meu primeiro nome, na divulgação da T4P.`
- Botão: `Enviar avaliação`

**Final (fim da Aula 3)**
- Título: `Que nota você dá para o curso?`
- Escala, caixa e botão iguais.
- Campo: rótulo `O que você já usou ou vai usar no seu negócio? (opcional)`, placeholder `Ex.: montei o assistente de vendas e respondi os clientes do WhatsApp com ele`

**Estados**
- Sucesso: `Obrigado! Sua avaliação foi registrada.` (substitui o formulário).
- Falha de rede/servidor: `Não deu para enviar agora. Tente de novo em instantes.` (formulário continua na tela, valores preservados).

## Mecanismo proposto

Validar contra o código real. Se divergir, reporte.

1. **Banco (`src/db.js`, única camada com SQL)**
   - `CREATE TABLE IF NOT EXISTS avaliacoes (user_id INTEGER NOT NULL REFERENCES users(id), etapa TEXT NOT NULL CHECK (etapa IN ('intermediaria','final')), nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5), comentario TEXT NOT NULL DEFAULT '', pode_divulgar INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, etapa))`.
   - Funções: `salvarAvaliacao(userId, etapa, nota, comentario, podeDivulgar)` (upsert; `atualizado_em` muda, `criado_em` não), `avaliacoesDoAluno(userId)` → `{ intermediaria: bool, final: bool }`, `resumoAvaliacoes()` → por etapa: respostas, média, contagem por nota 1–5, `listarAvaliacoes()` → linhas com nome, e-mail, etapa, nota, comentário, pode_divulgar, datas (mais recentes primeiro).

2. **Rota `POST /aluno/avaliacao`** (`auth.requireAluno` + `auth.checarOrigem` + rate limit 20/min por aluno, mesmo padrão do `limiteProgresso`)
   - Corpo JSON `{ etapa, nota, comentario, podeDivulgar }`.
   - Validar: `etapa` ∈ {intermediaria, final}; `nota` inteiro 1–5; `comentario` string opcional, `trim()`, até 1000 caracteres (acima disso → 400, não cortar em silêncio); `podeDivulgar` booleano (ausente = false). Qualquer outra coisa → 400.
   - Resposta 204.

3. **Snippet nas aulas 1 e 3 (`conteudo/Aula1*.html`, `conteudo/Aula3*.html`)**
   - Aula 1: bloco `<div class="avaliacao" data-etapa="intermediaria">` na seção final, **entre a lista `.cuidados` e a `.oferta`** (antes do "Ir para a Aula 2").
   - Aula 3: bloco equivalente com `data-etapa="final"` na seção `#s-final`, **antes** do CTA final. Conferir a estrutura real da seção.
   - Botões de nota = `<input type="radio" name="nota">` estilizados como botões (acessível por teclado), usando os tokens de cor já existentes na aula. "Enviar avaliação" desabilitado até escolher nota.
   - JS no `<script>` existente, só o necessário: montar o JSON, `fetch("/aluno/avaliacao", { method:"POST", headers:{"Content-Type":"application/json"}, body, credentials:"same-origin" })`; 204 → estado de sucesso; qualquer outro resultado → mensagem de falha. **Nada disso pode travar a navegação da aula**: sem `throw`, sem mexer em `ir()`, `pronto[]`, travas ou no "Refazer a aula".
   - Nenhuma outra linha das aulas muda. Diff dos arquivos no relatório.

4. **/aluno (cartão reserva)**
   - `progressoDoAlunoJson` ganha `avaliacoes: { intermediaria, final }` (vem de `avaliacoesDoAluno`).
   - Regra do cartão: se Aula 3 concluída e `final` não respondida → cartão final. Senão, se Aula 1 concluída e nem `intermediaria` nem `final` respondidas → cartão intermediário. No máximo **um** cartão por vez.
   - Posição: logo acima de `<h2>Suas aulas</h2>`. Mesmo formulário, mesmos textos, mesmo POST; visual com os tokens da página.
   - Ao voltar à aba (`visibilitychange` que já existe e busca `/aluno/progresso.json`): mostrar/esconder/trocar o cartão conforme a regra. Sugestão: renderizar os dois no servidor com `hidden` e só alternar o atributo. Escolha e justifique.
   - Após enviar com sucesso, o cartão mostra o agradecimento e não volta no próximo carregamento.

5. **/admin — bloco "Avaliações"** (abaixo de "Uso do conteúdo")
   - Resumo por etapa: respostas | média (1 casa decimal) | distribuição 1–5 (ex.: `1:0 · 2:1 · 3:2 · 4:5 · 5:9`).
   - Lista de comentários não vazios, mais recentes primeiro: data | etapa | nota | nome | comentário | "✓ pode divulgar" quando autorizado.
   - **Escapar HTML** de nome e comentário (`escapeHtml`). É texto livre de usuário renderizado no admin.
   - Link `Baixar avaliações (CSV)` → `GET /admin/avaliacoes.csv` (Basic Auth): mesmo formato do `vendas.csv` (BOM + `\r\n`), colunas `data;etapa;nota;nome;email;comentario;pode_divulgar`. Neutralizar injeção de fórmula: célula que começa com `=`, `+`, `-`, `@` ganha `'` na frente. O `vendas.csv` **não** muda.

6. **`/privacidade`** — acrescentar: registramos a nota e o comentário que você envia nas avaliações do curso; o comentário só é usado na divulgação se você marcar a autorização, e sempre só com o primeiro nome.

## Fora de escopo

- NPS 0–10, perguntas múltiplas, avaliação por aula (Aula 2), e-mail/WhatsApp pedindo avaliação.
- Página pública de depoimentos. Qualquer publicação de comentário é manual, pelo Guilherme.
- Checkout, webhook, /pagamento, VENDAS_ATE, `vendas.csv`, travas e navegação das aulas.

## Validação

- [ ] Migração idempotente em cópia do `data/t4p.db`: sobe duas vezes sem erro, dados antigos intactos, tabela `avaliacoes` criada.
- [ ] Playwright, aluno ativo: concluir a Aula 1 → bloco de avaliação na tela final; "Enviar" desabilitado sem nota; nota 4 + comentário + autorização → "Obrigado!"; `/admin` mostra a resposta com "✓ pode divulgar".
- [ ] Reenvio da mesma etapa com nota 5 → continua 1 resposta, nota 5 (upsert).
- [ ] Concluir a Aula 3 → avaliação final aparece e grava como `final`.
- [ ] /aluno: aluno com Aula 1 concluída e sem resposta vê o cartão intermediário; depois de responder, some após reload; com Aula 3 concluída e sem `final`, vê o cartão final (e só ele).
- [ ] `POST /aluno/avaliacao`: sem sessão → 302/401; sem Origin → 403; `etapa` inválida, `nota` 0/6/"4", comentário com 1001 caracteres → 400.
- [ ] POST falhando (`page.route(...).abort()`): mensagem de falha aparece, formulário mantém os valores, e a aula segue navegável ("Ir para a Aula 2", "Refazer a aula"), sem `pageerror`.
- [ ] Comentário `<img src=x onerror=alert(1)>` aparece como texto no /admin (sem executar).
- [ ] `avaliacoes.csv` baixa com BOM, colunas certas, e comentário começando com `=` sai com `'`.
- [ ] Prints (1280 e 390 px): bloco no fim da Aula 1 (antes/depois de enviar), fim da Aula 3, cartão no /aluno, bloco "Avaliações" no /admin. Em `docs/claude-bridge/evidencias/tarefa-13-avaliacao/`.
- [ ] `npm run e2e` completo verde, com os passos novos (reaproveitar `percorrerAula1Tema`/`percorrerAula3Tema`).

## Entrega

- Branch `tarefa/13-avaliacao` a partir da `main` atualizada.
- PR com base em `main`, **sem merge**. Prints e resultado do e2e na descrição.
- `docs/t4p-00-estado.md`: decisão "23/09 · Avaliação do curso (intermediária no fim da Aula 1, final no fim da Aula 3), nota 1–5 + comentário opcional + autorização de divulgação".
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `src/db.js`: tabela `avaliacoes` (`CREATE TABLE IF NOT EXISTS`, só aditiva) + `salvarAvaliacao` (upsert), `avaliacoesDoAluno`, `resumoAvaliacoes`, `listarAvaliacoes`.
  - `src/server.js`: `POST /aluno/avaliacao` (requireAluno + checarOrigem + 20/min por aluno, validação estrita, 204); `progressoDoAlunoJson` ganhou `avaliacoes` e `cartaoAvaliacao`; bloco "Avaliações" no /admin; `GET /admin/avaliacoes.csv` (BOM + `\r\n`, `protegerCsv`); textos das duas etapas num só lugar.
  - `src/views/avaliacao.html` (formulário único, usado no /aluno), `aluno.html` (cartões + JS), `admin.html`, `privacidade.html`.
  - `conteudo/Aula1*.html` e `Aula3*.html`: só acréscimos (+75 linhas cada, 0 removidas): CSS `.avaliacao` no fim do `<style id="tema-t4p">`, bloco HTML antes do `.oferta`, IIFE isolada no fim do `<script>` existente. Diff: `git diff main -- conteudo/`.
  - `scripts/e2e.js`: 16 passos novos. `docs/t4p-00-estado.md`: decisão registrada.
- **Validação:**
  - ✅ Migração idempotente: cópia do `data/t4p.db` (só tinha 1 usuário, sem pedidos/progresso), subiu 2× sem erro, contagens iguais, `avaliacoes` criada (`{"users":1,"orders":0,"progresso":0,"avaliacoes_tabela":1,"avaliacoes":0}` nas duas). O banco local é pequeno; a garantia real é o `IF NOT EXISTS`, sem `ALTER`.
  - ✅ Aula 1: bloco na tela final, "Enviar" desabilitado sem nota, nota 4 + comentário + autorização → "Obrigado!"; /admin mostra a resposta com "✓ pode divulgar" e resumo 1 resposta · média 4,0 · `4:1`.
  - ✅ Reenvio com nota 5 → continua 1 resposta, média 5,0, `5:1`.
  - ✅ Aula 3 → avaliação final aparece e grava como `final`.
  - ✅ /aluno: Aula 1 concluída sem resposta → só o cartão intermediário; após responder e recarregar, some; Aula 3 concluída sem `final` → só o cartão final (agradecimento não some ao voltar à aba; não volta após reload); quem respondeu as duas → 0 cartões.
  - ✅ POST: sem sessão → 302/401; sem Origin → 403; etapa inválida, nota 0/6/"4"/3.5, comentário de 1001 caracteres, comentário não-string, podeDivulgar não-booleano → 400; 1000 caracteres → 204.
  - ✅ POST abortado (`page.route().abort()`): mensagem de falha, valores preservados, botão volta a habilitar, "Ir para a Aula 2" e "Refazer a aula" seguem na tela e a navegação funciona, sem `pageerror`; reenvio com a rede de volta funciona.
  - ✅ `<img src=x onerror=alert(1)>` aparece como texto no /admin (HTML escapado, sem `<img>` no DOM, sem diálogo).
  - ✅ `avaliacoes.csv`: 401 sem auth; bytes EF BB BF, cabeçalho `data;etapa;nota;nome;email;comentario;pode_divulgar`, `\r\n`, comentário `=HYPERLINK(...)` sai com `'` na frente.
  - ✅ Prints 1280 e 390 em `docs/claude-bridge/evidencias/tarefa-13-avaliacao/` (aula1 antes/depois/falha, aula3 final/enviada, cartão intermediário e final no /aluno, bloco no /admin).
  - ✅ `npm run e2e`: `44/44 passos OK`.
- **Divergências:**
  - `progressoDoAlunoJson` devolve também `cartaoAvaliacao` (`"final" | "intermediaria" | null`), calculado no servidor: a regra do cartão fica num lugar só e o cliente apenas alterna `hidden`. Renderizei os dois cartões no servidor com `hidden` (como sugerido): sem flash e sem montar formulário no JS.
  - O cartão que acabou de enviar fica marcado `data-enviado` e o `visibilitychange` não o esconde, para o agradecimento não sumir sozinho ao voltar à aba.
  - Data no /admin e no CSV = `atualizado_em` (último envio), já que o reenvio sobrescreve. No CSV, `pode_divulgar` sai como `sim`/`não`.
  - O formulário usa `<label>` envolvendo cada input (sem ids), para existir duas vezes no /aluno sem id duplicado.
- **Achados:**
  - O e2e regrava vários PNGs de evidências de tarefas antigas (05, 08, 09, 10) a cada execução; reverti com `git checkout` para não poluir o diff.
  - `git pull` na `main` local não tem upstream configurado (usei `git merge --ff-only origin/main`).
- **Commit/branch:** `tarefa/13-avaliacao`; hash e link do PR no commit seguinte de docs.
