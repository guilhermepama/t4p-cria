# Tarefa 11 — Boas-vindas e "como fazer as aulas" na área do aluno

**Status: AGUARDANDO EXECUÇÃO**

- Tipo: código (template `/aluno` + render no `server.js` + e2e). Sem dependência nova, **sem migração**.
- Data: 23/09/2026
- Base: tarefas 01–10 concluídas e mergeadas (`origin/main` em `d3e008e`, PR #10).
- Antes de criar a branch: a working tree está na `tarefa/10-progresso-aluno` com esta tarefa e `concluidas/10-progresso-aluno.md` não versionadas. Faça `git checkout main && git pull`, leve os dois arquivos, crie `tarefa/11-boas-vindas` e faça primeiro o commit `docs: planejador — tarefa 11`.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, /admin, conteúdo das aulas.

## Objetivo

Quem entra no `/aluno` pela primeira vez hoje vê só 3 cartões e 7 arquivos, sem saber por onde começar, do que precisa, nem que a aula recomeça do início (decisão da tarefa 10). Um bloco de boas-vindas resolve isso na própria página, sem tela extra.

## Decisões de produto que não mudam

- **Bloco no topo do `/aluno`**, não modal, não tour, não página separada. Modal irrita e exige JS; página separada é um clique que o aluno pula.
- **`<details>` nativo** (sem JS novo): aberto (`open`) enquanto o aluno não iniciou nenhuma aula; fechado depois, com o resumo "Como funciona o curso" para quem quiser reler. O estado vem do progresso que já existe (`progressoDoAluno`): **nenhuma tabela ou coluna nova**, nenhum "já vi as boas-vindas" guardado.
- Texto abaixo é o aprovado. Ajustes de quebra/pontuação para caber no layout, sim; mudar promessa, prazo ou ordem, não.

## Texto do bloco

Resumo do `<details>` (sempre visível):
- Estado aberto: **"Comece por aqui"**
- Estado fechado: **"Como funciona o curso"**

Conteúdo:

> **Boas-vindas ao IA para Negócios.** São 3 aulas curtas, uns 50 minutos no total. Você sai com pedidos prontos para o seu negócio e com o seu primeiro assistente de IA configurado.
>
> **Do que você precisa**
> - Celular ou computador com internet.
> - Uma conta em uma IA de conversa: ChatGPT, Gemini ou Claude. A versão gratuita serve para começar.
> - As informações básicas do seu negócio à mão: o que você vende, para quem, preços e horários.
>
> **O caminho**
> 1. **Aula 1 — O pedido que funciona** · uns 15 min. Por que a IA responde genérico e como montar um pedido que funciona.
> 2. **Aula 2 — Conserte a resposta** · uns 15 min. O que fazer quando a resposta vem ruim, sem começar do zero.
> 3. **Aula 3 — Monte sua equipe** · uns 20 min. Seu primeiro assistente fixo. Deixe o *Manual de integração — modelo* aberto ao lado.
>
> Depois, os arquivos abaixo são para o dia a dia: assistentes prontos para colar na sua IA e o kit completo para consulta.
>
> **Como as aulas funcionam**
> - Cada aula abre em uma nova aba e vai passo a passo. Alguns passos pedem que você toque ou responda algo antes de liberar o "Continuar".
> - Faça cada aula de uma vez. Seu avanço aparece aqui, mas a aula sempre recomeça do início quando você a abre de novo.
> - Deixe a sua IA aberta em outra aba e teste o que aprender na hora. É assim que fica.
> - Não cole dados pessoais de clientes (CPF, telefone, endereço) na IA.
>
> Seu acesso vale até 24/12/2026. Travou em algum passo? [Chame no WhatsApp] ← link

- Os títulos das aulas no passo a passo vêm de `AULAS` (mesma fonte dos cartões), não digitados de novo. Os tempos e as descrições ficam no template ou num campo novo em `AULAS` — escolha e justifique.
- "Manual de integração — modelo" deve bater com o título em `DOWNLOADS`.
- Link do WhatsApp: `linkWhatsapp("Oi! Travei numa aula do kit IA para Negócios.")`, `target="_blank" rel="noopener"`, igual ao do rodapé.
- A data 24/12/2026 é texto fixo (o prazo não é aplicado no código hoje; não criar regra de expiração nesta tarefa).

## Mecanismo proposto

Validar contra o código real. Se divergir, reporte.

1. **`src/server.js`** (render do `/aluno`, perto da linha ~627): calcular `iniciouAlguma = Object.keys(progresso.aulas).length > 0` e passar ao template `boasVindasAberto` (`"open"` ou `""`), `resumoBoasVindas` ("Comece por aqui" / "Como funciona o curso") e `linkWhatsappAulas`. Escapar como os outros campos (o render já trata `{{}}` vs `{{{}}}`).
2. **`src/views/aluno.html`**: o `<details class="boas-vindas" {{boasVindasAberto}}>` entre o `<header>` e o `<h2>Suas aulas</h2>`.
   - Visual com os tokens atuais: fundo `--card`, borda `--border`, raio 14px, padding 18–20px. `summary` em Inter Tight 600, com um marcador próprio (▸/▾ ou chevron em CSS) e cursor pointer; esconder o marcador padrão (`summary::-webkit-details-marker{display:none}` + `list-style:none`).
   - Subtítulos internos ("Do que você precisa" etc.) em Inter Tight 15px; listas com 14.5px, `line-height` confortável; número do passo do caminho em destaque com o laranja (`--orange`).
   - Largura e espaçamentos do `.wrap` atual; sem layout novo fora do bloco. Em 360px nada estoura na horizontal.
   - **Nenhum `<script>` novo.** O script do `visibilitychange` da 10 não mexe no bloco (ao voltar da aula ele continua como estava; só no próximo carregamento fecha — aceitável).
3. Nada muda em `/aluno/progresso.json`, rotas, banco ou aulas.

## Fora de escopo

- Vídeo de boas-vindas, tour guiado, modal, e-mail/WhatsApp automático de boas-vindas após a compra.
- Marcar "próxima aula" nos cartões, retomar passo, certificado.
- Expiração real do acesso em 24/12.
- Qualquer coisa em checkout, webhook, /pagamento, VENDAS_ATE, /admin, CSV, `conteudo/`.

## Validação

- [ ] Aluno novo (sem progresso): `/aluno` mostra o bloco **aberto**, resumo "Comece por aqui", com os 3 títulos vindos de `AULAS` na ordem.
- [ ] Aluno com qualquer aula iniciada (`POST /aluno/progresso` com passo ≥ 1): após reload, bloco **fechado**, resumo "Como funciona o curso"; clicar no resumo abre e mostra o mesmo conteúdo.
- [ ] Apenas downloads (sem aula iniciada) → bloco continua aberto.
- [ ] Link do WhatsApp do bloco abre `wa.me` com a mensagem certa (conferir o `href`).
- [ ] Sem erro no console e sem violação de CSP em `/aluno` (desktop e mobile).
- [ ] Sem rolagem horizontal em 360px e 390px.
- [ ] Prints em `docs/claude-bridge/evidencias/tarefa-11-boas-vindas/`: 1280px e 390px, aberto e fechado.
- [ ] `npm run e2e` completo verde (29 passos da 10 + os novos). Reaproveitar os alunos e percursos existentes; se precisar de aluno novo, usar o `entrarComRetentativa()` da 10.

## Entrega

- Branch `tarefa/11-boas-vindas` a partir da `main` atualizada.
- PR com base em `main`, **sem merge**. Prints e resultado do e2e na descrição.
- `docs/t4p-00-estado.md`: decisão "23/09 · Boas-vindas no topo do /aluno (`<details>` aberto até iniciar a 1ª aula), sem estado novo no banco"; item 9 no backlog; corrigir o item 8 para "mergeado (PR #10)".
- Preencher o relatório e mudar o Status.

## Relatório do executor

(preencher)
