# Tarefa 02 · Login, área do aluno, conteúdo protegido e /admin (backlog 2)

**Status: CONCLUÍDA**

- **Tipo:** código. ⚠️ Mexe em senhas e dados pessoais. ⚠️ Troca uma dependência (sai o bcrypt).
- **Data:** 23/09/2026
- **Base:** relatório da tarefa 01 (`concluidas/01-esqueleto.md`); `t4p-01-especificacao.md` §3 e §5 (atualizadas pelo planejador); `t4p-00-estado.md` (decisões de 23/09)

## Antes de começar

1. Confira se `tarefa/01-esqueleto` já foi mergeada na `main`. Se **não** foi, pare e reporte como BLOQUEADA ("aguardando merge da 01"). Não crie a branch a partir da 01.
2. Há alterações de documentação do planejador ainda não commitadas na árvore de trabalho: CLAUDE.md, docs/t4p-00-estado.md, docs/t4p-01-especificacao.md, e a mudança de `claude-bridge/tarefa-atual.md` para `concluidas/01-esqueleto.md` com este arquivo novo. Crie `tarefa/02-aluno-admin` a partir da `main` e faça o **primeiro commit só com essa documentação**: `docs: planejador — tarefa 02 e decisões de 23/09`.

## Objetivo

Construir tudo o que funciona **sem o Mercado Pago**: o aluno entra com e-mail e senha, vê as 3 aulas e baixa o kit, e os sócios operam as vendas pelo /admin. Isso inclui cadastrar um aluno manualmente, que é o fallback de "PIX direto". Quando esta tarefa for mergeada, a T4P já consegue vender, mesmo se o checkout automático atrasar.

## Mecanismo proposto

Valide contra o código e a especificação. Se houver divergência, reporte.

1. **Dependências:** remova o `bcrypt` do package.json e do lock. `npm audit` deve ficar sem crítico/alto; se sobrar algum, registre em Achados.
2. **`src/auth.js`:**
   - `hashSenha` e `verificarSenha` com `crypto.scrypt`, conforme a §5.
   - Sessões: o token vai no cookie `t4p_sess` (32 bytes, hex; `httpOnly`, `secure` quando `NODE_ENV=production`, `sameSite=lax`, 30 dias). No banco só entra o **SHA-256** do token.
   - `requireAluno`: sessão válida **e** `users.ativo = 1`. Caso contrário, redireciona para `/entrar?volta=<rota>`, aceitando só caminhos relativos que começam com `/`.
   - `requireAdmin`: Basic Auth contra `ADMIN_USER`/`ADMIN_PASS` com `timingSafeEqual`. Se essas variáveis estiverem vazias, o /admin responde 503.
   - `checarOrigem`: middleware em todos os POSTs, exceto `/webhooks/mp`, que exige `Origin` (ou `Referer`) com a mesma origem de `BASE_URL`. Caso contrário, responde 403.
3. **`src/db.js`:** todas as queries novas ficam aqui (usuário por e-mail, sessões, listagem do admin, criar aluno manual com pedido `manual` numa transação, ativar, trocar senha, registrar e listar `eventos`). Rode a limpeza de sessões expiradas na inicialização.
4. **Rotas públicas:** `GET/POST /entrar` e `POST /sair`, com rate-limit de 10 por minuto por IP no POST. Use mensagem de erro única ("E-mail ou senha incorretos"). Um usuário inativo com a senha certa vê: "Seu acesso ainda não foi liberado. Se já pagou, fale com a gente."
5. **Área do aluno:**
   - `GET /aluno`: saudação com o nome, 3 cartões de aula (abrem em nova aba) e downloads (Kit PDF, Assistentes PDF, 3 .txt, 2 Manuais .docx), mais o botão Sair.
   - `GET /aluno/conteudo/:arquivo`: lista branca fixa com os 10 nomes. Aulas com `text/html` inline, os demais como download (`Content-Disposition: attachment`). Cabeçalho `Cache-Control: private, no-store`.
6. **Aulas em `conteudo/`:**
   - Aula 1: troque o bloco de venda ("Isso foi a aula 1 do kit…", preço, variável `PRECO` e o JS que a preenche) por um cartão "Próxima: Aula 2 — Conserte a resposta", com link para `/aluno/conteudo/Aula2_Conserte_a_Resposta.html`, e mantenha o "Voltar à área do aluno".
   - Aula 2: acrescente no fim um cartão "Próxima: Aula 3" e o "Voltar à área do aluno". Aula 3: acrescente só o "Voltar".
   - Use o estilo que cada aula já tem. Não mude o texto didático.
7. **/admin**, protegido por `requireAdmin`:
   - Topo: total de pedidos pagos + manuais, soma em R$ e número de pendentes.
   - Tabela de alunos com os pedidos: nome, e-mail, WhatsApp, status, valor, data em horário de Brasília (BRT).
   - Formulário **"Cadastrar aluno (PIX direto)"**: nome, e-mail, WhatsApp, senha temporária e valor (padrão `PRECO`). Cria o usuário ativo e o pedido `manual` numa transação só. E-mail duplicado dá erro claro.
   - Por linha: botão "Ativar" (usuário inativo → pedido `manual`) e "Nova senha" (define uma senha temporária informada pelo admin).
   - Link para `/admin/vendas.csv` (UTF-8 com BOM, separador `;`, para abrir direto no Excel) e as últimas 50 linhas de `eventos`.
   - Toda ação do admin grava um registro em `eventos`.
8. **Views** em `src/views/`: HTML simples no visual da landing (fundo escuro, Inter Tight, botões em pílula laranja), mobile-first. Valores do usuário sempre escapados. Basta um helper mínimo de template (substituir `{{chave}}` com escape). Nada de engine de templates.
9. **Script `npm run criar-aluno`** (`scripts/criar-aluno.js`): recebe nome, e-mail e senha por argumentos e cria um aluno ativo. Serve para testes e emergência.

## Fora de escopo

- `/comprar`, `/api/checkout`, `/pagamento`, webhook e qualquer chamada ao MP.
- `/privacidade`, favicon, og-image, avisos âmbar e `LINK_COMPRA` da landing.
- Recuperação de senha por e-mail.
- Qualquer mudança em `public/index.html`.

## Validação

1. `npm audit --omit=dev` sem crítico/alto, e `bcrypt` fora do lock.
2. `npm run criar-aluno` → login em `/entrar` funciona → `/aluno` lista 3 aulas e 7 downloads.
3. `/aluno` sem cookie → 302 para `/entrar?volta=/aluno`. `?volta=https://evil.com` é ignorado.
4. `/aluno/conteudo/../src/db.js` e `/aluno/conteudo/qualquer.txt` → 404. Arquivo válido sem sessão → 302.
5. Usuário inativo com a senha certa → vê a mensagem de acesso não liberado e não recebe cookie de sessão.
6. 11 tentativas de login em 1 minuto → a 11ª devolve 429.
7. Na tabela `sessions` não aparece nenhum token igual ao do cookie (só o hash).
8. `/admin` sem credencial → 401. Com credencial: cadastrar aluno manual → ele consegue entrar. Ativar um inativo e trocar a senha também funcionam. Os três geram `eventos`.
9. POST no `/admin/alunos` com `Origin: https://evil.com` → 403.
10. O CSV abre no Excel com acentos corretos (confira os bytes do BOM: `EF BB BF`).
11. As aulas abrem pela área do aluno, e os links "Próxima" e "Voltar" funcionam. `grep "R\$ 97"` na cópia da Aula 1 não encontra nada.
12. `docker build` e `run` com volume → login funciona e o aluno continua lá depois de recriar o container.

## Entrega

- Branch `tarefa/02-aluno-admin` com commits pequenos, **sem push e sem merge**.
- Atualize o backlog item 2 em `docs/t4p-00-estado.md`.
- Preencha o relatório abaixo e mude o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `package.json`/`package-lock.json`: `bcrypt` removido, script `npm run criar-aluno` adicionado.
  - `src/auth.js` (novo): `hashSenha`/`verificarSenha` (scrypt N=16384 r=8 p=1, formato `scrypt$salt$hash`, comparação com `timingSafeEqual`), `criarSessaoCookie`/`destruirSessaoCookie` (cookie `t4p_sess`, hash SHA-256 no banco), `caminhoRelativoSeguro`, `requireAluno`, `requireAdmin` (Basic Auth + `timingSafeEqual`, 503 se `ADMIN_USER`/`ADMIN_PASS` vazios), `checarOrigem` (CSRF por Origin/Referer vs `BASE_URL`).
  - `src/db.js`: queries de usuário por e-mail/id/sessão, criação/destruição de sessão, `criarAlunoManual` e `ativarAluno` (transações), `trocarSenha`, `criarAlunoAtivo` (para o script), `registrarEvento`/`listarEventosRecentes`, `listarAlunosComPedidos`, `resumoVendas`, e limpeza de sessões expiradas na inicialização.
  - `src/views/render.js` (helper mínimo `{{chave}}` escapado / `{{{chave}}}` raw) + `entrar.html`, `aluno.html`, `admin.html` no visual da landing (fundo escuro, Inter Tight, botões em pílula laranja), mobile-first.
  - `src/server.js`: rotas `GET/POST /entrar`, `POST /sair` (rate-limit 10/min/IP no POST), `GET /aluno`, `GET /aluno/conteudo/:arquivo` (lista branca `Map` com os 10 nomes), `GET /admin`, `POST /admin/alunos`, `POST /admin/ativar/:userId`, `POST /admin/senha/:userId`, `GET /admin/vendas.csv` (BOM UTF-8, `;`).
  - `conteudo/Aula1_O_Pedido_que_Funciona.html`: bloco de venda (`PRECO`, preço, JS que preenchia) trocado por cartão "Próxima: Aula 2" + link + "Voltar à área do aluno".
  - `conteudo/Aula2_Conserte_a_Resposta.html`: cartão final ganhou link real para a Aula 3 e "Voltar à área do aluno".
  - `conteudo/Aula3_Monte_sua_Equipe.html`: acrescentado só o "Voltar à área do aluno".
  - `scripts/criar-aluno.js` (novo) + script `npm run criar-aluno`.
  - `Dockerfile`: adicionado `COPY scripts ./scripts` (faltava; sem isso o script não existe na imagem).
  - `docs/t4p-00-estado.md`: item 1 marcado como mergeado, item 2 marcado como feito/aguardando merge.
- **Validação:**
  1. ✅ `npm audit --omit=dev` → "found 0 vulnerabilities"; `grep bcrypt package-lock.json` → vazio.
  2. ✅ `npm run criar-aluno -- "Fulano Teste" fulano@teste.com senha1234` → login em `/entrar` → 302; `/aluno` lista as 3 aulas (`AULAS.length===3`) e 7 downloads (`DOWNLOADS.length===7`).
  3. ✅ `/aluno` sem cookie → `302` para `/entrar?volta=%2Faluno`; `GET /entrar?volta=https://evil.com` → campo oculto `volta` vem como `/aluno` (ignorado).
  4. ✅ `/aluno/conteudo/../src/db.js` → `404`; `/aluno/conteudo/qualquer.txt` → `404`; arquivo válido (`Aula1...html`) sem sessão → `302`.
  5. ✅ Usuário inativo com senha certa → `403` com a mensagem exata; nenhum cookie `t4p_sess` foi setado (confirmado lendo o jar de cookies do curl).
  6. ✅ Em instância isolada (sem outras chamadas ao limiter antes), 10 tentativas seguidas devolveram `401` e a 11ª devolveu `429`.
  7. ✅ Comparando o valor do cookie com a coluna `token` da tabela `sessions`: são diferentes; `sha256(cookie) === token_no_banco` confirmado.
  8. ✅ `/admin` sem credencial → `401`. Com credencial: cadastro manual → `302` e o aluno criado loga (`302`); e-mail duplicado → `409`; `POST /admin/ativar/:id` em usuário inativo → `ativo=1` + nova linha em `orders` (status `manual`); `POST /admin/senha/:id` → nova senha verificável com `verificarSenha`. As 3 ações geraram linhas em `eventos` (`admin_cadastro_manual`, `admin_ativacao`, `admin_nova_senha`).
  9. ✅ `POST /admin/alunos` com `Origin: https://evil.com` (e credencial válida) → `403`.
  10. ✅ CSV: primeiros 3 bytes `EF BB BF`; nome com acento (`José Ção`) chega correto no arquivo quando enviado com bytes UTF-8 reais (ver Divergências sobre o teste com curl/shell).
  11. ✅ Links "Próxima"/"Voltar" abrem as rotas certas (`/aluno/conteudo/AulaN...html`, `/aluno`); `grep "R\$ 97" conteudo/Aula1_O_Pedido_que_Funciona.html` → sem resultado.
  12. ✅ `docker build` + `docker run` com bind mount → `npm`/script `criar-aluno` dentro do container → login `302` → `docker rm -f` + novo `docker run` no mesmo volume → login continua `302` (aluno persistiu). Precisei de `MSYS_NO_PATHCONV=1` e path Windows explícito no bind mount, mesma questão já registrada no relatório da tarefa 01.
- **Divergências:**
  - Dockerfile: acrescentei `COPY scripts ./scripts`, que não estava no mecanismo proposto mas é necessário para `npm run criar-aluno` funcionar dentro do container (o script é descrito como ferramenta de "testes e emergência", inclusive em produção).
  - Tabela do `/admin`: é uma linha por par (usuário, pedido) via `LEFT JOIN`; um aluno com mais de um pedido aparece em mais de uma linha, cada uma com seus próprios botões "Ativar"/"Nova senha". Funciona, mas repete a ação por linha em vez de agrupar por aluno — não implementei agrupamento por ser decisão de UI não especificada e o volume esperado é pequeno (~17 alunos).
  - Ao testar acentos no CSV (item 10) pelo terminal Git Bash/PowerShell deste ambiente Windows, o codepage do console (850, não UTF-8) corrompeu o argumento antes de chegar no `curl`. Confirmei que o problema era só do terminal de teste (não do app) reenviando a mesma requisição via um cliente HTTP em Node com bytes UTF-8 reais: o CSV saiu com os acentos corretos. Registro isso para quem for reproduzir os testes manualmente no Windows.
- **Achados** (fora do escopo, não corrigidos):
  - Nenhum novo além dos já registrados na tarefa 01 (favicon/og-image ausentes). O achado de `npm audit` da tarefa 01 (crítico/alto via `bcrypt`/`tar`/`node-pre-gyp`) está resolvido nesta tarefa como consequência de remover o `bcrypt`.
- **Commit/branch:** branch `tarefa/02-aluno-admin`, criada a partir da `main` pós-merge da tarefa 01 (`beca235`). Commits: `bdaf959` (docs do planejador), `6578435` (troca de CTA nas aulas), `0cbd0e8` (remoção do bcrypt), `0e31232` (auth.js + db.js), `04a10a8` (script criar-aluno), `372e473` (rotas + views), `3862bc3` (fix Dockerfile). Sem push, sem merge.
