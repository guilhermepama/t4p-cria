"use strict";

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const auth = require("./auth");
const { render, escapeHtml } = require("./views/render");

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, db: db.ping() });
});

// ---------- conteúdo do kit (lista branca) ----------

const CONTEUDO_DIR = path.join(__dirname, "..", "conteudo");

const AULAS = [
  { arquivo: "Aula1_O_Pedido_que_Funciona.html", titulo: "Aula 1 — O pedido que funciona" },
  { arquivo: "Aula2_Conserte_a_Resposta.html", titulo: "Aula 2 — Conserte a resposta" },
  { arquivo: "Aula3_Monte_sua_Equipe.html", titulo: "Aula 3 — Monte sua equipe" },
];

const DOWNLOADS = [
  { arquivo: "IA_para_Negocios_Kit_Completo.pdf", titulo: "Kit completo (PDF)" },
  { arquivo: "T4P_Assistentes_Prontos.pdf", titulo: "Assistentes prontos (PDF)" },
  { arquivo: "assistente_vendas.txt", titulo: "Assistente de vendas (.txt)" },
  { arquivo: "assistente_marketing.txt", titulo: "Assistente de marketing (.txt)" },
  { arquivo: "assistente_gestao.txt", titulo: "Assistente de gestão (.txt)" },
  { arquivo: "Manual_de_Integracao_da_IA_Template.docx", titulo: "Manual de integração — modelo (.docx)" },
  { arquivo: "Manual_de_Integracao_Exemplo_Lanchonete.docx", titulo: "Manual de integração — exemplo (.docx)" },
];

const ARQUIVOS_PERMITIDOS = new Map();
AULAS.forEach((a) => ARQUIVOS_PERMITIDOS.set(a.arquivo, "html"));
DOWNLOADS.forEach((d) => ARQUIVOS_PERMITIDOS.set(d.arquivo, "download"));

// ---------- helpers de formatação ----------

function formatarBRT(textoUtc) {
  if (!textoUtc) return "—";
  const data = new Date(textoUtc.replace(" ", "T") + "Z");
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarBRL(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------- /entrar, /sair ----------

const limiteEntrar = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/entrar", (req, res) => {
  const volta = auth.caminhoRelativoSeguro(req.query.volta) || "/aluno";
  res.send(
    render("entrar.html", {
      volta,
      email: "",
      mensagemErro: "",
    })
  );
});

app.post("/entrar", limiteEntrar, auth.checarOrigem, (req, res) => {
  const email = String(req.body.email || "").trim();
  const senha = String(req.body.senha || "");
  const volta = auth.caminhoRelativoSeguro(req.body.volta) || "/aluno";

  const usuario = db.buscarUsuarioPorEmail(email);
  const senhaOk = usuario && auth.verificarSenha(senha, usuario.senha_hash);

  if (!usuario || !senhaOk) {
    return res.status(401).send(
      render("entrar.html", {
        volta,
        email,
        mensagemErro: '<p class="erro">E-mail ou senha incorretos.</p>',
      })
    );
  }

  if (!usuario.ativo) {
    return res.status(403).send(
      render("entrar.html", {
        volta,
        email,
        mensagemErro:
          '<p class="erro">Seu acesso ainda não foi liberado. Se já pagou, fale com a gente.</p>',
      })
    );
  }

  auth.criarSessaoCookie(res, usuario.id);
  res.redirect(volta);
});

app.post("/sair", auth.checarOrigem, (req, res) => {
  auth.destruirSessaoCookie(req, res);
  res.redirect("/entrar");
});

// ---------- área do aluno ----------

app.get("/aluno", auth.requireAluno, (req, res) => {
  const aulasHtml = AULAS.map(
    (a) => `
      <div class="card">
        <h3>${escapeHtml(a.titulo)}</h3>
        <a class="btn" href="/aluno/conteudo/${encodeURIComponent(a.arquivo)}" target="_blank" rel="noopener">Abrir aula</a>
      </div>`
  ).join("\n");

  const downloadsHtml = DOWNLOADS.map(
    (d) => `
      <div class="download">
        <span>${escapeHtml(d.titulo)}</span>
        <a href="/aluno/conteudo/${encodeURIComponent(d.arquivo)}">Baixar</a>
      </div>`
  ).join("\n");

  res.send(render("aluno.html", { nome: req.aluno.nome, aulasHtml, downloadsHtml }));
});

app.get("/aluno/conteudo/:arquivo", auth.requireAluno, (req, res) => {
  const arquivo = req.params.arquivo;
  const tipo = ARQUIVOS_PERMITIDOS.get(arquivo);
  if (!tipo) return res.status(404).send("Não encontrado.");

  res.set("Cache-Control", "private, no-store");

  if (tipo === "html") {
    return res.sendFile(arquivo, { root: CONTEUDO_DIR, cacheControl: false });
  }

  return res.download(arquivo, arquivo, { root: CONTEUDO_DIR, cacheControl: false });
});

// ---------- /admin ----------

function renderAdmin(res, { statusCode = 200, mensagemErro = "" } = {}) {
  const resumo = db.resumoVendas();
  const alunos = db.listarAlunosComPedidos();
  const eventos = db.listarEventosRecentes(50);

  const linhasAlunos = alunos.length
    ? alunos
        .map((linha) => {
          const status = linha.status || "sem pedido";
          const acoes = [];
          if (!linha.ativo) {
            acoes.push(
              `<form class="acao" method="POST" action="/admin/ativar/${linha.user_id}"><button class="btn-mini" type="submit">Ativar</button></form>`
            );
          }
          acoes.push(`
            <form class="acao" method="POST" action="/admin/senha/${linha.user_id}" style="display:inline-flex;gap:4px;align-items:center">
              <input type="text" name="senha" placeholder="nova senha" minlength="8" required style="width:110px;padding:4px 8px;font-size:12px;border-radius:6px;border:1px solid #232329;background:#0f0f12;color:#f2ede4">
              <button class="btn-mini" type="submit">Nova senha</button>
            </form>`);
          return `<tr>
            <td>${escapeHtml(linha.nome)}</td>
            <td>${escapeHtml(linha.email)}</td>
            <td>${escapeHtml(linha.whatsapp || "—")}</td>
            <td class="status-${escapeHtml(status)}">${escapeHtml(status)}</td>
            <td>${linha.valor != null ? escapeHtml(formatarBRL(linha.valor)) : "—"}</td>
            <td>${escapeHtml(formatarBRT(linha.criado_em))}</td>
            <td>${acoes.join(" ")}</td>
          </tr>`;
        })
        .join("\n")
    : '<tr><td colspan="7">Nenhum aluno cadastrado ainda.</td></tr>';

  const linhasEventos = eventos.length
    ? eventos
        .map(
          (e) =>
            `<div>${escapeHtml(formatarBRT(e.criado_em))} — ${escapeHtml(e.tipo)}${e.detalhe ? ": " + escapeHtml(e.detalhe) : ""}</div>`
        )
        .join("\n")
    : "<div>Nenhum evento registrado ainda.</div>";

  res.status(statusCode).send(
    render("admin.html", {
      mensagemErro: mensagemErro ? `<p class="erro">${escapeHtml(mensagemErro)}</p>` : "",
      totalPagos: String(resumo.total_pagos),
      somaFormatada: formatarBRL(resumo.soma),
      pendentes: String(resumo.pendentes),
      linhasAlunos,
      linhasEventos,
      preco: process.env.PRECO || "97.00",
    })
  );
}

app.get("/admin", auth.requireAdmin, (req, res) => {
  renderAdmin(res);
});

app.post("/admin/alunos", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim();
  const whatsapp = String(req.body.whatsapp || "").trim() || null;
  const senha = String(req.body.senha || "");
  const valor = Number(req.body.valor || process.env.PRECO || 0);

  if (!nome || !email || senha.length < 8 || !Number.isFinite(valor) || valor <= 0) {
    return renderAdmin(res, { statusCode: 400, mensagemErro: "Dados inválidos para cadastro." });
  }

  try {
    db.criarAlunoManual({ nome, email, whatsapp, senhaHash: auth.hashSenha(senha), valor });
  } catch (erro) {
    if (String(erro.message).includes("UNIQUE")) {
      return renderAdmin(res, { statusCode: 409, mensagemErro: "Já existe um aluno com este e-mail." });
    }
    throw erro;
  }

  db.registrarEvento("admin_cadastro_manual", `email=${email}`);
  res.redirect("/admin");
});

app.post("/admin/ativar/:userId", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const usuario = db.buscarUsuarioPorId(req.params.userId);
  if (!usuario) return renderAdmin(res, { statusCode: 404, mensagemErro: "Aluno não encontrado." });

  db.ativarAluno(usuario.id, Number(process.env.PRECO || 0));
  db.registrarEvento("admin_ativacao", `user_id=${usuario.id}`);
  res.redirect("/admin");
});

app.post("/admin/senha/:userId", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const usuario = db.buscarUsuarioPorId(req.params.userId);
  if (!usuario) return renderAdmin(res, { statusCode: 404, mensagemErro: "Aluno não encontrado." });

  const senha = String(req.body.senha || "");
  if (senha.length < 8) {
    return renderAdmin(res, { statusCode: 400, mensagemErro: "A senha precisa ter ao menos 8 caracteres." });
  }

  db.trocarSenha(usuario.id, auth.hashSenha(senha));
  db.registrarEvento("admin_nova_senha", `user_id=${usuario.id}`);
  res.redirect("/admin");
});

app.get("/admin/vendas.csv", auth.requireAdmin, (req, res) => {
  const linhas = db.listarAlunosComPedidos();
  const cabecalho = "pedido;nome;email;whatsapp;valor;status;pago_em";
  const corpo = linhas
    .map((l) =>
      [
        l.order_id ?? "",
        l.nome,
        l.email,
        l.whatsapp || "",
        l.valor != null ? String(l.valor).replace(".", ",") : "",
        l.status || "",
        l.pago_em ? formatarBRT(l.pago_em) : "",
      ]
        .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\r\n");

  const csv = "﻿" + cabecalho + "\r\n" + corpo + "\r\n";
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="vendas.csv"');
  res.send(csv);
});

app.use((req, res) => {
  res.status(404).send("Não encontrado.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`t4p-app ouvindo na porta ${PORT}`);
});
