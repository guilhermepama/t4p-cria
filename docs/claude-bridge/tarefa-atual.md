# Tarefa 12 — Partes da landing somem no celular (render)

**Status: CONCLUÍDA**

- Tipo: CSS da landing (`public/index.html`). Sem JS, sem dependência, sem migração.
- Data: 23/09/2026
- Base: tarefas 01–11 concluídas e mergeadas (`origin/main` em `ee46000`, PR #11).
- Antes de criar a branch: a working tree está na `tarefa/11-boas-vindas` com esta tarefa e `concluidas/11-boas-vindas.md` não versionadas. Faça `git checkout main && git pull`, leve os dois arquivos, crie `tarefa/12-render-mobile` e faça primeiro o commit `docs: planejador — tarefa 12`.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Mudança só de CSS dentro de media query; não tocar checkout, webhook, /pagamento, VENDAS_ATE, /admin, `conteudo/`.

## Problema (relato de usuária, prints de celular Android — aparentemente Samsung Internet)

Em https://iadojeitocerto.com, seções aparecem com o kicker e a primeira parte do `<h2>`, e o resto fica preto: o `<span class="serif">` do título, os parágrafos e o card "Pedido comum". Num print, a linha "Pense na IA como um" está cortada ao meio na horizontal; noutro, há uma faixa marrom logo abaixo do header.

O HTML está íntegro e essas seções não têm animação nem JS. O padrão (blocos retangulares sem pintar, corte de glifo em linha reta, resíduo sob o header) é falha de rasterização/composição da GPU do aparelho, não bug de conteúdo.

## Causa provável (em ordem)

1. `body::before` (≈ linha 54): camada `position:fixed` de tela inteira com SVG `feTurbulence` gerado em tempo real — recomposta a cada quadro de rolagem.
2. `header` (≈ linha 116): `backdrop-filter: blur(14px)` sobre conteúdo que rola.
3. `.hero::after`, `.offer::before`, `.final::before`: `filter: blur(28–30px / 10px)` sobre `radial-gradient` (que já é suave).

## Mecanismo proposto

Validar contra o código real. Se divergir, reporte.

Adicionar **no fim do `<style>`** de `public/index.html` (desktop com mouse continua idêntico):

```css
@media (max-width: 768px), (hover: none) {
  body::before { display: none; }
  header {
    backdrop-filter: none; -webkit-backdrop-filter: none;
    background: rgba(11,11,13,.96);
  }
  .hero::after, .offer::before, .final::before { filter: none; }
}
```

- Se o executor achar outros `filter`/`backdrop-filter` grandes ou camadas `position:fixed` de tela cheia na landing, **registrar em Achados**, não mexer.
- Não alterar `04_Site/` (é fonte). As views em `src/views/` não usam `feTurbulence` nem `backdrop-filter` (conferido pelo planejador); não mexer nelas.

## Fora de escopo

- Trocar o granulado por PNG, redesenhar brilhos, qualquer mudança de texto, layout ou cores no desktop.

## Validação

- [ ] Diff restrito ao bloco `@media` novo em `public/index.html`.
- [ ] Playwright em 360, 390 e 430 px de largura (emulação mobile, `hasTouch`): screenshot de página inteira em `docs/claude-bridge/evidencias/tarefa-12-render-mobile/`; conferir que `body::before` tem `display:none` e que `getComputedStyle(header).backdropFilter` é `none`.
- [ ] Em 1280 px (sem touch): `backdropFilter` do header continua `blur(14px)` e o granulado continua visível — screenshot `depois-desktop-1280.png`.
- [ ] Nenhuma rolagem horizontal em 360 px.
- [ ] Observação no relatório: o defeito original depende do aparelho e **não se reproduz no Chromium headless**; a validação real é o Guilherme pedir à usuária para abrir de novo depois do deploy.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:** bloco `@media (max-width: 768px), (hover: none)` no fim do `<style>` de `public/index.html` (10 linhas): remove `body::before`, `backdrop-filter` do header (fundo `rgba(11,11,13,.96)`) e `filter` de `.hero::after`, `.offer::before`, `.final::before`. Evidências em `docs/claude-bridge/evidencias/tarefa-12-render-mobile/`.
- **Validação:**
  - ✅ Diff restrito ao bloco `@media` novo (`git diff --stat`: 1 arquivo, +10).
  - ✅ Playwright (`hasTouch`, `isMobile`) em 360/390/430: `body::before` display `none`, header `backdropFilter` `none`; screenshots `depois-mobile-{360,390,430}.png`.
  - ✅ 1280 px sem touch: `backdropFilter` = `blur(14px)`, `body::before` display `block`; `depois-desktop-1280.png`.
  - ✅ Sem rolagem horizontal em 360 px (scrollWidth 360 = clientWidth 360).
  - ✅ Observação: o defeito depende do aparelho e não se reproduz no Chromium headless; a validação real é a usuária reabrir o site após o deploy.
- **Divergências:** nenhuma. Mecanismo confere com o código (linhas 55, 116, 147, 443, 500). Local `main` estava desatualizada; fiz fast-forward para `origin/main` (ee46000) antes de criar a branch.
- **Achados:** nenhum outro `filter`/`backdrop-filter` grande nem camada `position:fixed` de tela cheia na landing (só `filter:brightness` em hover de botões).
- **Commit/branch:** `tarefa/12-render-mobile`
