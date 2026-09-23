# t4p-app

App de venda e entrega do kit **IA para Negócios** (T4P – Tech for People) em https://iadojeitocerto.com.

Landing → cadastro → PIX (Mercado Pago) → liberação automática → área do aluno. O painel /admin serve para os sócios.

## Stack

Node 20 · Express · SQLite (better-sqlite3) · Docker · Coolify (VPS Hostinger).

## Rodar localmente

```bash
cp .env.example .env    # preencha os valores
npm install
npm run dev             # http://localhost:3000
```

## Docker

```bash
docker build -t t4p-app .
docker run -p 3000:3000 --env-file .env -v "$PWD/data:/app/data" t4p-app
```

## Documentação

| Arquivo | Para quê |
|---|---|
| `CLAUDE.md` | Regras do agente executor |
| `docs/t4p-00-estado.md` | Estado, decisões e backlog (fonte da verdade do produto) |
| `docs/t4p-01-especificacao.md` | Contrato técnico: rotas, banco, fluxo PIX, segurança |
| `docs/t4p-02-deploy-coolify.md` | Passo a passo de produção (DNS, Coolify, MP) |
| `docs/claude-bridge/` | Canal planejador ↔ executor |
