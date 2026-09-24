# Tarefa 14 — Avaliação com estrelas no lugar dos botões 1–5

**Status: CONCLUÍDA**

- Tipo: visual do formulário de avaliação (HTML/CSS + JS mínimo). Sem migração, sem rota nova, sem dependência.
- Data: 23/09/2026
- Base: tarefa 13 concluída na branch `tarefa/13-avaliacao` (commit `64e14f5`), **PR ainda não mergeado**.
- **Branch:** continue na própria `tarefa/13-avaliacao` (novo commit no mesmo PR), para o Guilherme mergear avaliação + estrelas de uma vez. Primeiro commit: `docs: planejador — tarefa 14` (leva esta tarefa e `concluidas/13-avaliacao.md`).
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, CSVs, navegação/travas das aulas.

## Decisão do Guilherme

A escala 1–5 vira **5 estrelas**. O valor enviado continua `nota` inteiro 1–5; servidor, banco, /admin e CSV **não mudam**.

## Onde

Os 3 lugares onde o formulário existe hoje (tarefa 13):
- `conteudo/Aula1_O_Pedido_que_Funciona.html` (etapa intermediária)
- `conteudo/Aula3_Monte_sua_Equipe.html` (etapa final)
- `src/views/avaliacao.html` + CSS/JS em `src/views/aluno.html` (cartões do /aluno)

## Mecanismo proposto

Validar contra o código real. Se divergir, reporte.

1. **HTML** — manter os 5 `<input type="radio" name="nota" value="1..5">` dentro dos `<label class="nota">` (acessibilidade e JS de envio seguem iguais). Trocar o `<span>N</span>` por um **SVG inline de estrela** (`viewBox="0 0 24 24"`, um `<path>` de estrela de 5 pontas, `aria-hidden="true"`) e dar a cada input `aria-label="1 estrela"`, `"2 estrelas"`… `"5 estrelas"`. **Não** usar o caractere ★ (no Android pode virar emoji ou mudar de fonte).
2. **CSS** — `.escala` vira uma linha de estrelas (flex, `gap` ~6px, alinhada à esquerda), sem as caixas com borda.
   - Estrela: ~40px no desktop, ~36px em ≤ 400px; área de toque ≥ 44px (padding no label).
   - Vazia: só contorno (`stroke` na cor `--muted`/`--line` do tema, `fill: none`).
   - Preenchida: `fill` e `stroke` na cor de destaque do tema (`--coral` nas aulas, `--orange` no /aluno — a mesma cor que hoje marca o botão selecionado).
   - `focus-visible` com contorno visível na estrela focada.
   - Transição curta (≤ 120ms) no preenchimento; respeitar `prefers-reduced-motion`.
3. **JS (mínimo, dentro da IIFE de avaliação que já existe)** — o preenchimento "até a estrela escolhida" não sai só com CSS de forma compatível (`:has()` falha em navegadores de celular mais antigos, e o público é de celular):
   - Ao mudar a nota: classe `cheia` nas estrelas `<= nota`.
   - Hover (só `@media (hover: hover)`): pré-visualizar `cheia` até a estrela sob o mouse; ao sair da escala, voltar para a nota escolhida.
   - Teclado (setas) continua funcionando pelo comportamento nativo do radio; o `change` atualiza o preenchimento.
   - Nada disso toca o envio, a mensagem de falha ou a navegação da aula.
4. **Legenda** — manter `1 = não gostei` / `5 = gostei muito`, trocando para `1 estrela = não gostei` e `5 estrelas = gostei muito`. Acrescentar ao lado das estrelas um texto curto que mostra a escolha: vazio antes de escolher, depois `4 de 5` (muted, `aria-live="polite"`).

## Fora de escopo

- Meia estrela, mudar perguntas/textos (fora a legenda acima), mudar /admin (pode continuar mostrando número), qualquer coisa no servidor.

## Validação

- [ ] `git diff 64e14f5 -- src/server.js src/db.js` vazio.
- [ ] Nas 3 superfícies: clicar na 4ª estrela → 4 estrelas cheias, "4 de 5", "Enviar" habilitado; envio grava `nota = 4` (conferir no /admin).
- [ ] Trocar para a 2ª → só 2 cheias. Hover em desktop pré-visualiza e volta ao sair.
- [ ] Teclado: Tab chega na escala, setas mudam a nota e o preenchimento acompanha; foco visível.
- [ ] Leitor de tela/árvore de acessibilidade (Playwright `getByRole('radio', { name: '3 estrelas' })`) encontra as 5 opções.
- [ ] Sem rolagem horizontal em 360 px; toque na estrela funciona com `hasTouch`.
- [ ] Prints 1280 e 390 px (sem escolha, com 4 estrelas, após enviar) nas aulas 1 e 3 e no /aluno, em `docs/claude-bridge/evidencias/tarefa-14-estrelas/`.
- [ ] `npm run e2e` verde (ajustar os seletores dos passos da 13 que clicavam nos números, sem mudar o que eles verificam). Reverter PNGs de tarefas antigas regravados pelo e2e, como na 13.

## Entrega

- Commit(s) na `tarefa/13-avaliacao`, push; o PR da 13 passa a incluir as estrelas. Atualizar a descrição do PR com os prints novos. **Sem merge.**
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:** os 5 radios `name="nota"` ficam; o `<span>N</span>` virou SVG de estrela inline (`aria-hidden`) e cada input ganhou `aria-label` "1 estrela"…"5 estrelas". CSS novo (`.escala` flex, estrela 40px / 36px ≤400px, toque ≥44px, vazia só contorno `--muted`, cheia `--coral` nas aulas e `--orange` no /aluno, foco visível, transição 120ms, `prefers-reduced-motion`). JS mínimo dentro da IIFE existente: classe `cheia` até a nota, hover só em `(hover: hover)` e volta à nota ao sair, texto "N de 5" com `aria-live="polite"`. Legenda: "1 estrela = não gostei" / "5 estrelas = gostei muito". Arquivos: `conteudo/Aula1_…html`, `conteudo/Aula3_…html`, `src/views/avaliacao.html` (HTML) e `src/views/aluno.html` (CSS/JS), `scripts/e2e.js`.
- **Validação:**
  - ✅ `git diff 64e14f5 -- src/server.js src/db.js` → vazio (0 linhas).
  - ✅ 4ª estrela → 4 cheias, "4 de 5", Enviar habilitado; envio grava nota=4 (passo e2e do /admin confere).
  - ✅ 2ª estrela → 2 cheias; hover em desktop pré-visualiza (3 e 5) e volta à nota escolhida ao sair (passo e2e "estrelas").
  - ✅ Teclado: setas mudam a nota, preenchimento acompanha, `outline-style` do foco ≠ none.
  - ✅ `getByRole('radio', { name: '4 estrelas' })` acha as 5 opções (checado nas aulas).
  - ✅ 360 px sem rolagem horizontal (/aluno) e `tap()` com `hasTouch` pinta 4 e habilita Enviar. Nas aulas o CSS é o mesmo, mas 360 px foi medido só no /aluno.
  - ✅ Prints 1280/390 em `docs/claude-bridge/evidencias/tarefa-14-estrelas/` (aulas 1 e 3: antes, 4 estrelas, enviada, falha; /aluno: cartões intermediário/final e 4 estrelas).
  - ✅ `npm run e2e` → 45/45 (ajustei o seletor da legenda e usei `getByRole`; 1 passo novo para hover/teclado/360/toque). PNGs antigos regravados pelo e2e foram revertidos.
- **Divergências:** nenhuma no mecanismo. `src/views/aluno.html` só tem CSS/JS (o HTML das estrelas vem de `avaliacao.html`). `.check()` nos radios usa `force: true` no e2e porque o SVG cobre o input transparente.
- **Achados:** nenhum.
- **Commit/branch:** `tarefa/13-avaliacao` — commits de docs `645bbee` e o das estrelas (hash no push).
