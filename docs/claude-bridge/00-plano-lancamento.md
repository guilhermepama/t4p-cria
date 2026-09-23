# T4P · Plano de produção — iadojeitocerto.com

> Detalhes técnicos (rotas, banco, fluxo PIX) estão em `../t4p-01-especificacao.md`, que vence este plano em caso de divergência.

Versão 1 · 22/09/2026 · VPS Hostinger + Coolify

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime | Node 20 LTS | Um só processo, que você já conhece |
| Servidor | Express 4 | Rotas simples, sem mágica de framework |
| Banco | SQLite (better-sqlite3, modo WAL) | Um arquivo num volume persistente e nenhum container extra |
| Senha | bcrypt (custo 11) | Padrão seguro |
| Sessão | Cookie httpOnly + tabela `sessions` no SQLite | Sem Redis |
| Segurança | helmet, express-rate-limit | Headers e freio no login/cadastro |
| Pagamento | API de Pagamentos do Mercado Pago (PIX) via `fetch` | Sem SDK: são 2 chamadas (criar e consultar) |
| Front | Landing atual (HTML estático) + 4 páginas simples no mesmo estilo | Sem build step |
| Deploy | Dockerfile → Coolify (GitHub App) → Traefik + Let's Encrypt | Deploy automático a cada push, com HTTPS |

### Quanto aguenta

Numa VPS de entrada (1–2 vCPU), esse desenho aguenta com folga **milhares de alunos cadastrados e algumas centenas de acessos simultâneos**. Os gargalos reais aparecem nesta ordem:

1. **Login:** o bcrypt leva ~80 ms por tentativa → ~10–20 logins/segundo por núcleo. Seria preciso centenas de pessoas logando no mesmo segundo para travar.
2. **Escrita no SQLite:** as escritas acontecem uma de cada vez, e isso é na casa de milhares por segundo. Cadastro e pagamento geram 2–3 escritas cada.
3. **Banda dos PDFs** (~600 KB por aluno): irrelevante.

O limite estrutural é outro: **uma instância só**. Se um dia precisar de 2+ containers atrás de um load balancer, o SQLite sai e entra o Postgres. Como todo o acesso ao banco fica isolado em `db.js`, essa troca custa um dia. Para 17 vendas (ou 1.700), não é problema.

## 2. Arquitetura

```
Visitante ─► /            landing (public/index.html)
          ─► /comprar     cadastro (nome, e-mail, WhatsApp, senha)
                            └─► POST /api/checkout → cria usuário (inativo) + pedido
                                 └─► MP POST /v1/payments (pix) → QR + copia-e-cola
          ─► /pagamento/:id  QR na tela; consulta /api/pedido/:id a cada 3 s
Mercado Pago ─► POST /webhooks/mp  valida assinatura → GET /v1/payments/{id}
                                     → approved + R$ 97 → ativa usuário e pedido
Aluno     ─► /entrar → /aluno   3 aulas + downloads (rotas protegidas)
Sócios    ─► /admin             vendas, total, CSV, ativar manual, redefinir senha
```

**Dupla confirmação:** a rota `/api/pedido/:id` também consulta o MP diretamente quando o pedido ainda está pendente. Assim, se o webhook atrasar ou falhar, o aluno é liberado mesmo assim. O webhook nunca confia no corpo que recebe: ele sempre reconsulta o pagamento na API.

## 3. Estrutura do repositório (`t4p-app`, privado)

```
t4p-app/
├── Dockerfile
├── .env.example
├── package.json
├── src/
│   ├── server.js        rotas e middlewares
│   ├── db.js            schema + queries (único ponto de acesso ao banco)
│   ├── mp.js            criar/consultar pagamento, validar assinatura
│   ├── auth.js          hash, sessão, middleware requireAluno/requireAdmin
│   └── views/           comprar, pagamento, entrar, aluno, admin (HTML)
├── public/              index.html (landing) + og-image, favicon
└── conteudo/            aulas HTML, PDFs, .docx, .txt — NUNCA servido sem login
```

### Banco

- `users(id, nome, email UNIQUE, whatsapp, senha_hash, ativo, criado_em)`
- `orders(id, user_id, mp_payment_id, valor, status, criado_em, pago_em)`
- `sessions(token, user_id, expira_em)`

### Variáveis de ambiente (Coolify)

`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PRECO` (97.00), `BASE_URL` (https://iadojeitocerto.com), `ADMIN_USER`, `ADMIN_PASS`, `TRUST_PROXY` (2), `DB_PATH` (/app/data/t4p.db).

## 4. Pré-requisitos (fazer ANTES de codar — são as coisas que travam)

1. **Chave PIX cadastrada na conta Mercado Pago.** Sem ela, a API recusa pagamento PIX. Confira em Seu negócio → Pix.
2. **Credenciais de produção do MP:** crie uma aplicação em mercadopago.com.br/developers → "Pagamentos online" → ative as credenciais de produção e pegue o Access Token (`APP_USR-...`).
3. **Webhook no painel do MP:** URL `https://iadojeitocerto.com/webhooks/mp`, evento *Pagamentos*. Copie a **assinatura secreta** gerada.
4. **IP da VPS**, e o Coolify acessível e atualizado.
5. **Repo privado `t4p-app` no GitHub**, conectado ao Coolify via GitHub App.
6. **DNS na GoDaddy (fazer hoje, porque a propagação demora):** apague o registro A de "parking" e crie `A  @  → IP da VPS` e `CNAME  www → iadojeitocerto.com`.

## 5. Plano de execução

Prazo do fallback: **quarta 23/09 às 22h**. Se o PIX real não tiver sido aprovado de ponta a ponta até lá, vendemos por PIX direto + ativação manual no /admin. O /admin fica pronto antes do checkout justamente para o fallback já existir.

| # | Quando | Etapa | Pronto quando |
|---|---|---|---|
| 0 | Ter 22/09 noite | Pré-requisitos 1–6 | DNS apontado, credenciais em mãos |
| 1 | Qua manhã | Esqueleto + Dockerfile + deploy da landing no Coolify | https://iadojeitocerto.com abre com cadeado |
| 2 | Qua manhã | Banco, cadastro, login, área do aluno, conteúdo protegido | Aluno criado à mão entra e baixa o kit; `/conteudo/*` sem login dá 401 |
| 3 | Qua meio-dia | /admin (lista, total, CSV, ativar manual, redefinir senha) | **Fallback operacional** |
| 4 | Qua tarde | Checkout PIX + tela de QR + polling | QR real gerado |
| 5 | Qua tarde | Webhook com validação de assinatura + reconsulta | Log mostra assinatura válida |
| 6 | Qua 18h | **Teste real com `PRECO=1.00`**: pagar R$ 1 com seu celular, ver a liberação, estornar no MP | Acesso liberado sozinho em < 10 s |
| 7 | Qua 19h | `PRECO=97.00`, preencher `LINK_COMPRA` (landing, amostra, Aula 1), remover os avisos âmbar | Checklist de publicação ok |
| 8 | Qui | Divulgação liberada + CSV no /admin alimenta o controle financeiro | — |

### Detalhes que já ficam decididos

- **Idempotência:** o header `X-Idempotency-Key` recebe o id do pedido, e o webhook ignora pagamento já processado.
- **Validade do PIX:** 30 min. Um pedido expirado pode gerar um novo QR sem refazer o cadastro.
- **E-mail já cadastrado e ativo:** a tela manda para /entrar. Se estiver cadastrado e inativo, reaproveita o usuário e gera novo PIX.
- **Aula 1 dentro da área do aluno:** o CTA de compra sai, porque ele já comprou.
- **Backup:** exportar o CSV no /admin ao fim de cada dia e salvar em `06_Financeiro`. O arquivo `.db` fica num volume persistente do Coolify, então sobrevive a redeploy.
- **LGPD mínima:** uma página /privacidade curta (quais dados coletamos e por quê) com link no rodapé do cadastro.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Credencial de produção do MP pendente de aprovação | Resolver hoje (pré-requisito 2); se travar, fallback |
| Webhook não chega (firewall, URL errada) | Polling reconsulta o MP; log no /admin |
| Volume não persistente no Coolify → banco apagado no redeploy | Configurar storage `/app/data` **antes** da primeira venda; testar com um redeploy |
| Conteúdo acessível por URL direta | Pasta `conteudo/` fora de `public/`, servida só por rota protegida |
| Reembolso/garantia | Estorno pelo painel do MP + desativar no /admin |

## 7. Quem faz o quê

- **Claude:** todo o código, Dockerfile e checklist de configuração do Coolify, escritos na pasta do projeto.
- **Guilherme:** pré-requisitos (MP, DNS, GitHub, Coolify), push e o teste de R$ 1.
