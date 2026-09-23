# t4p-01 · Especificação técnica

Contrato técnico do app. Quando esta especificação e uma tarefa divergirem, o executor reporta a divergência em vez de escolher um lado.

## 1. Estrutura

```
t4p-app/
├── Dockerfile            node:20-slim, npm ci --omit=dev, USER node, EXPOSE 3000
├── package.json          scripts: start (node src/server.js), dev (node --watch src/server.js)
├── src/
│   ├── server.js         app Express, middlewares, montagem de rotas, /health
│   ├── db.js             conexão, schema (CREATE IF NOT EXISTS), todas as queries
│   ├── auth.js           hash/verify, criar/destruir sessão, requireAluno, requireAdmin
│   ├── mp.js             criarPix(), consultarPagamento(), validarAssinatura()
│   ├── routes/           publico.js, aluno.js, admin.js, webhook.js
│   └── views/            comprar.html, pagamento.html, entrar.html, aluno.html, admin.html, privacidade.html
├── public/               index.html (landing), favicon, og-image — servido estático
└── conteudo/             aulas e arquivos do kit — servidos SÓ pela rota protegida
```

## 2. Banco (SQLite, WAL, foreign_keys=ON)

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp TEXT,
  senha_hash TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mp_payment_id TEXT UNIQUE,
  valor REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | pago | expirado | manual | estornado
  pix_copia_cola TEXT,
  pix_qr_base64 TEXT,
  expira_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,           -- SHA-256 do token do cookie (o token em si só existe no cookie)
  user_id INTEGER NOT NULL REFERENCES users(id),
  expira_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eventos (   -- log de webhook e ações do admin
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Datas em UTC. Na tela, converter para America/Sao_Paulo.

## 3. Rotas

| Método | Rota | Acesso | Função |
|---|---|---|---|
| GET | `/health` | público | `{ok:true}` + checagem do banco |
| GET | `/` | público | landing (public/index.html) |
| GET | `/comprar` | público | formulário: nome, e-mail, WhatsApp, senha (mín. 8), aceite de privacidade |
| POST | `/api/checkout` | público, rate-limit | cria/reaproveita usuário inativo + pedido + PIX → `{pedidoId}` |
| GET | `/pagamento/:id` | público* | QR + copia-e-cola + botão copiar + contador de expiração |
| GET | `/api/pedido/:id` | público* | `{status}`; se pendente, reconsulta o MP (no máx. 1× a cada 5 s por pedido) |
| POST | `/webhooks/mp` | MP | valida assinatura, reconsulta, ativa. Responde 200 rápido |
| GET/POST | `/entrar`, `/sair` | público | login por e-mail + senha (rate-limit), logout |
| GET | `/aluno` | aluno ativo | página com as 3 aulas + downloads |
| GET | `/aluno/conteudo/:arquivo` | aluno ativo | entrega de arquivo de `conteudo/` com lista branca de nomes |
| GET | `/admin` | admin (Basic Auth) | vendas, total bruto, pendentes |
| POST | `/admin/alunos` | admin | cria aluno já ativo + pedido `manual` (fallback PIX direto): nome, e-mail, WhatsApp, senha temporária, valor |
| POST | `/admin/ativar/:userId` | admin | ativação manual (fallback PIX direto) → pedido `manual` |
| POST | `/admin/senha/:userId` | admin | define nova senha temporária |
| GET | `/admin/vendas.csv` | admin | export: pedido, nome, e-mail, WhatsApp, valor, status, pago_em (BRT) |
| GET | `/privacidade` | público | dados coletados, finalidade, contato |

\* `/pagamento/:id` e `/api/pedido/:id` usam um **token opaco** do pedido (ex.: 16 bytes hex, coluna extra `token`), nunca o id sequencial, para ninguém enumerar pedidos.

Quando o pedido vira `pago`, a página de pagamento cria a sessão do aluno e redireciona para `/aluno` (o aluno entra direto, sem digitar a senha de novo).

## 4. Fluxo PIX (Mercado Pago)

**Criar pagamento:** `POST https://api.mercadopago.com/v1/payments`

- Headers: `Authorization: Bearer ${MP_ACCESS_TOKEN}`, `X-Idempotency-Key: T4P-<pedido.token>`
- Corpo:
  ```json
  {
    "transaction_amount": 97.00,
    "description": "T4P · IA para Negócios",
    "payment_method_id": "pix",
    "external_reference": "T4P-<pedido.id>",
    "notification_url": "${BASE_URL}/webhooks/mp",
    "date_of_expiration": "<agora + 30 min, ISO 8601 com offset -03:00>",
    "payer": { "email": "...", "first_name": "..." }
  }
  ```
- Da resposta, gravar `id` → `mp_payment_id`, `point_of_interaction.transaction_data.qr_code` → copia-e-cola e `...qr_code_base64` → imagem.

**Webhook** `POST /webhooks/mp?data.id=<id>&type=payment`:

1. Ler `x-signature` (`ts=...,v1=...`) e `x-request-id`.
2. Montar o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Se o `data.id` for alfanumérico, usar em minúsculas.
3. `HMAC-SHA256(manifesto, MP_WEBHOOK_SECRET)` em hex. Comparar com `v1` usando `crypto.timingSafeEqual`. Se falhar: registrar em `eventos` e responder 401.
4. `GET /v1/payments/<data.id>`. Só ativar se `status === "approved"`, `transaction_amount >= PRECO` e `external_reference` começar com `T4P-` e bater com o pedido.
5. A ativação é idempotente: numa transação, marca o pedido como `pago` (se ainda não estiver) e o usuário como `ativo = 1`.
6. Sempre registrar em `eventos` e responder 200, inclusive para eventos ignorados.

**Reconsulta pelo polling:** mesma checagem do passo 4, chamada por `/api/pedido/:id`. É a rede de segurança caso o webhook falhe.

**Reaproveitamento:** e-mail já cadastrado e **ativo** → resposta 409 com orientação para ir a `/entrar`. E-mail cadastrado e **inativo** → atualiza nome, WhatsApp e senha e cria um novo pedido.

## 5. Segurança

- CSP com `'unsafe-inline'` em script/style é aceita (a landing e as aulas têm inline; não há conteúdo gerado por usuário renderizado como HTML). Todo dado de usuário exibido em views é escapado.
- CSRF: POSTs (exceto webhook) exigem `Origin`/`Referer` = `BASE_URL`.
- helmet (a CSP precisa permitir as fontes do Google usadas pela landing e imagens `data:` para o QR).
- Cookie de sessão: `httpOnly`, `secure` em produção, `sameSite=lax`, validade de 30 dias.
- Senha: `crypto.scrypt` (N=16384, r=8, p=1, salt 16 bytes, chave 64 bytes), gravada como `scrypt$<salt hex>$<hash hex>`; comparação com `timingSafeEqual`. Rate-limit de 10 req/min por IP em `/entrar` e `/api/checkout`.
- `app.set('trust proxy', 1)`, porque o app fica atrás do Traefik do Coolify.
- Lista branca de arquivos em `/aluno/conteudo/:arquivo`, sem montar caminho a partir da entrada do usuário.
- Nenhum segredo aparece em log. No log, o e-mail vai mascarado (`g***@gmail.com`).

## 6. Conteúdo do kit (copiar de `03_Produto_Aula_Digital/Versao_Final_para_Entrega/`)

Aula1_O_Pedido_que_Funciona.html · Aula2_Conserte_a_Resposta.html · Aula3_Monte_sua_Equipe.html · IA_para_Negocios_Kit_Completo.pdf · T4P_Assistentes_Prontos.pdf · assistente_vendas.txt · assistente_marketing.txt · assistente_gestao.txt · Manual_de_Integracao_da_IA_Template.docx · Manual_de_Integracao_Exemplo_Lanchonete.docx

As aulas abrem no navegador (`Content-Type: text/html`). Os demais arquivos vão como download.

Na cópia da Aula 1 dentro de `conteudo/`, o CTA final de compra deve ser removido ou trocado por "Voltar à área do aluno". O arquivo original em `03_…` não é editado.
