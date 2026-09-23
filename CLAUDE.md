# CLAUDE.md — t4p-app (agente EXECUTOR)

Você é o **executor** do t4p-app: o app que vende e entrega o kit **IA para Negócios** da T4P em https://iadojeitocerto.com.
Quem planeja é outra sessão do Claude (o **planejador**), e o Guilherme é o dono das decisões de produto.

## Como você recebe trabalho

1. Leia `docs/claude-bridge/tarefa-atual.md`. Execute **apenas** o que estiver nela, e só se o Status for `AGUARDANDO EXECUÇÃO`.
2. Antes de codar, leia `docs/t4p-00-estado.md` (fatos do produto) e `docs/t4p-01-especificacao.md` (contrato técnico).
3. Ao terminar, preencha a seção `## Relatório do executor` da própria tarefa e mude o Status para `CONCLUÍDA` ou `BLOQUEADA`.
4. **Não** comece a próxima tarefa, **não** arquive a tarefa e **não** escreva tarefas novas: isso é papel do planejador.

## Relatório do executor (formato)

- **Status:** CONCLUÍDA | BLOQUEADA (motivo em 1 linha)
- **Feito:** lista curta do que mudou (arquivos principais)
- **Validação:** cada item da seção Validação da tarefa com ✅/❌ e a evidência (comando + saída resumida)
- **Divergências:** onde você fugiu do mecanismo proposto e por quê
- **Achados:** problemas vistos fora do escopo (não corrija; só registre)
- **Commit/branch:** nome da branch e hash

## Regras permanentes

- Trabalhe numa branch `tarefa/NN-nome-curto` criada a partir da `main` atualizada. **Nunca** faça push direto na `main`, **nunca** faça merge, **nunca** force-push. O merge é do Guilherme, e o Coolify faz deploy da `main`.
- **Segredos nunca entram no repositório.** Tokens do Mercado Pago, senhas e o `.env` ficam fora do git; só o `.env.example` é versionado.
- Pagamento: o webhook **nunca** confia no corpo da requisição. Ele sempre valida a assinatura e reconsulta `GET /v1/payments/{id}`, conferindo status, valor e `external_reference` com prefixo `T4P-`.
- `conteudo/` **nunca** é servido estaticamente. Só a rota protegida por sessão de aluno ativo pode entregá-lo.
- Todo acesso ao banco passa por `src/db.js`. Nenhum SQL fora dele.
- Dependências mínimas: express, better-sqlite3, bcrypt, helmet, express-rate-limit, cookie-parser. Adicionar qualquer outra exige justificativa no relatório.
- Sem build step no front: HTML/CSS/JS puros, reaproveitando o visual da landing (`public/index.html`).
- Textos visíveis ao usuário em português do Brasil.
- Se a tarefa conflitar com a especificação ou com o código, **pare e reporte como BLOQUEADA**. Não decida sozinho questões de produto (preço, texto de oferta, dados de alunos, dinheiro).
- Não altere nada fora de `09_App/t4p-app/`. As pastas `03_Produto…` e `04_Site/` são fontes: copie delas, não edite.
