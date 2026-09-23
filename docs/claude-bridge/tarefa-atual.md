# Tarefa 09 — Aulas com o visual da landing: validar e versionar o tema já aplicado

**Status: CONCLUÍDA**

- Tipo: versionamento + validação em navegador real. **O código já está pronto** na working tree; não é para redesenhar nada.
- Data: 23/09/2026
- Base: tarefa 08 concluída (PR #8 aberto, sem merge). As duas tarefas não compartilham arquivos de código; o único ponto comum é `docs/t4p-00-estado.md`.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, `src/`.

## Contexto (responde ao achado da tarefa 08)

As mudanças em `conteudo/Aula1…`, `Aula2…` e `Aula3….html` que apareceram na working tree **são trabalho do planejador**, feito a pedido do Guilherme: as aulas estavam com o visual antigo (verde-petróleo/creme, DM Serif) e layout só de mobile. Foi aplicado o tema da landing por sobreposição, sem mexer na lógica:

1. Link do Google Fonts trocado para o da landing (Inter Tight, Instrument Serif, Inter) + IBM Plex Mono.
2. Bloco novo `<style id="tema-t4p">` antes de `</head>`: tokens da landing, fundo escuro com granulado, botões em pílula com degradê, cartões escuros, hero com moldura/cantos laranja e brilho, coluna de 720–780px no desktop com grids de 2/4 colunas. Modo claro removido (sempre escuro, como a landing).
3. `<header class="topo">` inserido antes de `<main class="app">`: "T4P. IA para Negócios" + botão "Área do aluno" (`/aluno`).
4. `<h1 id="t0">`: uma palavra envolvida em `<span class="serif">`.
5. SVGs decorativos (xícaras): só os `fill` trocados para a paleta laranja.
6. Aula 1: "Aula 1 do kit, grátis." → "Aula 1 de 3 do kit." (contradizia a decisão de 23/09: não há aula grátis).

Nenhum `<script>` foi alterado.

## O que fazer

1. `git stash` das 3 aulas (ou deixe-as na working tree ao trocar de branch, já que o arquivo é igual na `main` e na 08), `git checkout main`, criar `tarefa/09-visual-aulas`, trazer as 3 aulas modificadas.
2. Commit 1: `docs: planejador — tarefa 09` (esta tarefa + `concluidas/08-entrar-esqueci-senha.md`, se não estiverem na main).
3. **Conferir o diff antes do commit** (critério de aceite, não opinião estética): para cada aula, o diff só pode conter os 6 itens listados acima. Qualquer linha alterada dentro de `<script>` = BLOQUEADA.
4. Commit 2: `feat: aulas com o visual da landing`.
5. Validar (abaixo), anexar prints em `evidencias/tarefa-09-aulas/`, abrir PR com base em `main`, **sem merge**.

## Validação

- [ ] Diff restrito aos 6 itens; nenhuma linha de `<script>` alterada (mostrar comando e saída).
- [ ] Logado como aluno ativo, abrir as 3 aulas via `/aluno/conteudo/...` em 1440px, 390px e 360px e **percorrer todos os passos até o final** em Playwright (resolvendo as travas como um aluno faria, ou via clique nos elementos interativos). Sem erro no console.
- [ ] Nenhuma violação de CSP no console: fontes do Google carregam (conferir `document.fonts.check('16px "Instrument Serif"')` e `"Inter Tight"` = true).
- [ ] 360px: `scrollWidth <= clientWidth` em todos os passos; "Passo X de Y" não quebra linha na barra inferior.
- [ ] Topo: "Área do aluno" leva a `/aluno`; nos cartões finais, "Ir para a Aula 2", "Ir para a Aula 3" e "Voltar à área do aluno" funcionam.
- [ ] Aula 1, passo "monte o pedido": "Copiar pedido" continua funcionando.
- [ ] Prints: hero + 2 passos de cada aula (desktop e 390px).
- [ ] e2e completo verde. Se possível, adicionar um passo que abre cada aula e confere a presença de `#tema-t4p` e `.topo`.

## Fora de escopo

- Qualquer ajuste de CSS/visual além de corrigir algo **quebrado** (texto ilegível, elemento cortado, scroll horizontal). Nesse caso, corrigir só dentro de `<style id="tema-t4p">` e listar em Divergências.
- `03_Produto_Aula_Digital/` (fonte original): não editar.
- `/aluno`, `/entrar`, landing, backend.

## Entrega

- Branch `tarefa/09-visual-aulas` a partir da `main`; PR sem merge, prints e resultado do e2e na descrição.
- `docs/t4p-00-estado.md`: decisão "23/09 · Aulas com o visual da landing (tema escuro fixo); 'Aula 1 grátis' removido". Adicionar no fim da tabela para facilitar o merge com a 08.
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `git stash` das 3 aulas + `tarefa-atual.md`, `main` atualizada (fast-forward, já trazia o PR #8 mergeado), branch `tarefa/09-visual-aulas` criada e stash trazido de volta.
  - Commit 1 (`3f90489`): `docs: planejador — tarefa 09` — `tarefa-atual.md` (tarefa 09) + `docs/claude-bridge/concluidas/08-entrar-esqueci-senha.md` (nenhum dos dois estava na `main`).
  - Diff das 3 aulas conferido linha a linha antes do commit (ver Validação) — só os 6 itens do enunciado.
  - Commit 2 (`0f8727e`): `feat: aulas com o visual da landing` — as 3 aulas com o tema.
  - Commit 3 (`671e422`): `test: valida tema das aulas (1440/390/360px, tema/fontes/CSP/console)` — adiciona a `scripts/e2e.js` as funções `percorrerAula1Tema/2Tema/3Tema`, `conferirTemaEFontes`, `conferirPasso` (scroll/quebra em 360px) e `conferirSemErrosNoConsole`, e 4 passos novos de e2e; prints em `docs/claude-bridge/evidencias/tarefa-09-aulas/`; adiciona a decisão em `docs/t4p-00-estado.md`.
  - PR #9 aberto contra a `main`, sem merge: https://github.com/guilhermepama/t4p-cria/pull/9
- **Validação:**
  - [✅] Diff restrito aos 6 itens; nenhuma linha de `<script>` alterada — `git diff main HEAD -- conteudo/Aula1…` etc. conferidos manualmente: todos os hunks terminam antes da linha de abertura do `<script>` de cada aula (Aula1: hunks até a linha 571, `<script>` abre em 579; Aula2: até 359, `<script>` em 364; Aula3: até 178, `<script>` em 363). `git diff main HEAD --stat` nas 3 aulas ficou vazio antes do commit da tarefa 09 (ou seja, a única mudança nelas é exatamente a do tema).
  - [✅] Logado como aluno ativo, abri as 3 aulas via `/aluno/conteudo/...` em 1440px, 390px e 360px e percorri todos os passos até o final via Playwright (`npm run e2e`, funções `percorrerAula1Tema/2Tema/3Tema`), resolvendo cada trava com clique real (letras do CAFÉ, diagnóstico da Aula 2, listas de toque da Aula 3, checklist etc.). Sem erro no console em nenhuma execução — `22/22 passos OK`.
  - [✅] Nenhuma violação de CSP no console — o Chromium loga violação de CSP como erro de console, e o teste falha em qualquer erro de console; nenhuma ocorreu. Fontes do Google carregam — **divergência**: `document.fonts.check('16px "Instrument Serif"')`/`"Inter Tight"` (peso/estilo padrão 400 normal) dá falso negativo porque o tema só usa Instrument Serif em itálico e nunca pede Inter Tight no peso 400 (só 500–800); troquei por checar se alguma variante da família está com `status "loaded"` em `document.fonts`, confirmado também por rede (200 nos `.woff2` de `fonts.gstatic.com`, ver diagnóstico manual antes do commit).
  - [✅] 360px: `scrollWidth <= clientWidth` em todos os passos e "Passo X de Y" sem quebra de linha (checado via `Range.getClientRects().length <= 1` no `#passo`) — sem falhas nas 3 aulas.
  - [✅] Topo "Área do aluno" → `/aluno` (checado em todas as combinações; clicado de fato no 1440px). Nos cartões finais: "Ir para a Aula 2" e "Ir para a Aula 3" clicados de fato (1440px, navegação real confirmada por `waitForURL`); "Voltar à área do aluno" clicado de fato ao final da Aula 3 (1440px), chegando em `/aluno`. Nas demais viewports (390/360), o href de `.topo-link` é checado (sem clicar, para não interromper o percurso).
  - [✅] Aula 1, "monte o pedido": clico em "Copiar pedido" (com permissão de clipboard concedida no contexto) e confiro que o texto do botão muda para "Pedido copiado" — testado nas 3 viewports.
  - [✅] Prints: hero + 2 passos de cada aula, em 1440px e 390px (18 arquivos) — `docs/claude-bridge/evidencias/tarefa-09-aulas/`.
  - [✅] e2e completo verde: `npm run e2e` → `22/22 passos OK` (rodado localmente antes de abrir o PR). O passo "abre cada aula e confere `#tema-t4p`/`.topo`" foi integrado dentro de cada percurso (`conferirTemaEFontes`), em vez de um passo isolado — mais fiel ao fluxo real do aluno.
- **Divergências:**
  - Checagem de fontes: ver item acima (troquei o `document.fonts.check(...)` literal do enunciado por uma checagem equivalente, mas robusta ao peso/estilo real usado pelo tema). Não é um problema das aulas — é o comportamento normal do CSS Font Loading API quando você pergunta por uma combinação peso/estilo que a página nunca chegou a solicitar/renderizar.
  - Não editei nada dentro de `<style id="tema-t4p">` — não achei nada quebrado (texto ilegível, elemento cortado, scroll horizontal) em nenhuma das 3 viewports pedidas.
- **Achados:** nenhum fora do escopo desta tarefa.
- **Commit/branch:** `tarefa/09-visual-aulas`, HEAD `671e422` (commits `3f90489`, `0f8727e`, `671e422`). PR #9: https://github.com/guilhermepama/t4p-cria/pull/9

