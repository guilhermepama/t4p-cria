# Tarefa 09 — Aulas com o visual da landing: validar e versionar o tema já aplicado

**Status: AGUARDANDO EXECUÇÃO**

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

