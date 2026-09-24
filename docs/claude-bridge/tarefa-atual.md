# Tarefa 15 — Tirar a legenda das estrelas

**Status: CONCLUÍDA**

- Tipo: remoção de texto/CSS no formulário de avaliação. Sem servidor, sem banco, sem dependência.
- Data: 24/09/2026
- Base: tarefa 14 concluída na `tarefa/13-avaliacao`, PR ainda não mergeado.
- **Branch:** continue na `tarefa/13-avaliacao` (mesmo PR). Primeiro commit: `docs: planejador — tarefa 15` (esta tarefa + `concluidas/14-estrelas.md`).
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, CSVs, navegação das aulas.

## Decisão do Guilherme

Remover a linha `1 estrela = não gostei` / `5 estrelas = gostei muito` nas 3 superfícies. As estrelas e o texto `N de 5` ficam.

## O que mudar

1. Remover o `<div class="legenda">…</div>` em:
   - `conteudo/Aula1_O_Pedido_que_Funciona.html`
   - `conteudo/Aula3_Monte_sua_Equipe.html`
   - `src/views/avaliacao.html`
2. Remover a regra `.avaliacao .legenda { … }` do CSS das duas aulas e de `src/views/aluno.html`.
3. Espaçamento: a legenda dava ~16px entre as estrelas e o campo de comentário. Garantir esse respiro (ex.: `margin-bottom: 16px` na `.escala` ou no bloco que contém estrelas + `N de 5`). Nada mais muda de layout.
4. `scripts/e2e.js`: trocar a checagem da legenda (≈ linha 1372) por uma que confirme que `.legenda` **não existe** no bloco.

## Validação

- [ ] `git diff` restrito aos 5 arquivos acima; `src/server.js` e `src/db.js` intocados.
- [ ] Nenhuma ocorrência de `1 estrela = não gostei` nem de `.legenda` em `conteudo/` e `src/views/` (`grep`).
- [ ] Prints 390 px das aulas 1 e 3 e do cartão no /aluno mostrando estrelas → comentário com espaçamento correto, em `docs/claude-bridge/evidencias/tarefa-15-sem-legenda/`.
- [ ] `npm run e2e` verde. Reverter PNGs antigos regravados, como nas anteriores.

## Entrega

- Commit(s) na `tarefa/13-avaliacao` + push. Sem merge.
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:** removido o `<div class="legenda">` das aulas 1 e 3 e de `src/views/avaliacao.html`; removida a regra `.avaliacao .legenda` das duas aulas e de `src/views/aluno.html`; `.escala` ganhou `margin-bottom: 16px` (o respiro que a legenda dava). `scripts/e2e.js`: a checagem da legenda agora confirma que `.legenda` não existe.
- **Validação:**
  - ✅ `git diff --stat`: só os 5 arquivos da tarefa (server.js e db.js intocados).
  - ✅ `grep` por `.legenda`/"estrela = " em `conteudo/` e `src/views/`: nenhuma ocorrência (restam só "legendas" de Instagram, texto sem relação).
  - ✅ Prints 390 px (aulas 1 e 3, cartão no /aluno; sem escolha e com 4 estrelas) em `docs/claude-bridge/evidencias/tarefa-15-sem-legenda/`; espaçamento estrelas → comentário conferido no print.
  - ✅ `npm run e2e`: 45/45; PNGs antigos regravados foram revertidos.
- **Divergências:** nenhuma.
- **Achados:** nenhum.
- **Commit/branch:** `tarefa/13-avaliacao` (PR #14).
