"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "t4p.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const dbJaExistia = fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
  token TEXT UNIQUE,
  valor REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  pix_copia_cola TEXT,
  pix_qr_base64 TEXT,
  expira_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expira_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS progresso (
  user_id INTEGER NOT NULL REFERENCES users(id),
  item TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('aula', 'download')),
  passo INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  concluido INTEGER NOT NULL DEFAULT 0,
  primeiro_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item)
);
CREATE TABLE IF NOT EXISTS avaliacoes (
  user_id INTEGER NOT NULL REFERENCES users(id),
  etapa TEXT NOT NULL CHECK (etapa IN ('intermediaria', 'final')),
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '',
  pode_divulgar INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, etapa)
);
`);

function migrar() {
  const colunasOrders = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!colunasOrders.includes("login_feito")) {
    db.exec("ALTER TABLE orders ADD COLUMN login_feito INTEGER NOT NULL DEFAULT 0");
  }
  const colunasUsers = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!colunasUsers.includes("is_teste")) {
    db.exec("ALTER TABLE users ADD COLUMN is_teste INTEGER NOT NULL DEFAULT 0");
  }
}
migrar();

// Registros de teste (checkout PIX + webhook validados): ficam no banco, mas fora dos relatórios do /admin.
const EMAILS_TESTE = ["guilhermepama1+teste@gmail.com", "guilhermepama1+pix@gmail.com"];
db.prepare(
  `UPDATE users SET is_teste = 1
   WHERE is_teste = 0 AND email IN (${EMAILS_TESTE.map(() => "?").join(", ")}) COLLATE NOCASE`
).run(...EMAILS_TESTE);

db.prepare("DELETE FROM sessions WHERE expira_em <= datetime('now')").run();

if (!dbJaExistia) {
  registrarEvento("db_criado", `DB_PATH=${DB_PATH}`);
  if (process.env.NODE_ENV === "production") {
    console.warn(
      `Banco novo criado em ${DB_PATH}. Se isto aconteceu depois de um redeploy, o volume /app/data NÃO está persistindo.`
    );
  }
}

function ping() {
  return db.prepare("SELECT 1 AS ok").get().ok === 1;
}

function buscarUsuarioPorEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
}

function buscarUsuarioPorId(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function criarSessao(tokenHash, userId, expiraEm) {
  db.prepare("INSERT INTO sessions (token, user_id, expira_em) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiraEm
  );
}

function destruirSessao(tokenHash) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(tokenHash);
}

function buscarUsuarioPorSessao(tokenHash) {
  return db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expira_em > datetime('now')`
    )
    .get(tokenHash);
}

function criarAlunoAtivo(nome, email, senhaHash, whatsapp) {
  const info = db
    .prepare(
      "INSERT INTO users (nome, email, whatsapp, senha_hash, ativo) VALUES (?, ?, ?, ?, 1)"
    )
    .run(nome, email, whatsapp || null, senhaHash);
  return info.lastInsertRowid;
}

const criarAlunoManualStmt = db.transaction((dados) => {
  const info = db
    .prepare(
      "INSERT INTO users (nome, email, whatsapp, senha_hash, ativo) VALUES (?, ?, ?, ?, 1)"
    )
    .run(dados.nome, dados.email, dados.whatsapp, dados.senhaHash);
  const userId = info.lastInsertRowid;
  db.prepare(
    "INSERT INTO orders (user_id, valor, status, pago_em) VALUES (?, ?, 'manual', datetime('now'))"
  ).run(userId, dados.valor);
  return userId;
});

function criarAlunoManual(dados) {
  return criarAlunoManualStmt(dados);
}

const ativarAlunoStmt = db.transaction((userId, valor) => {
  db.prepare("UPDATE users SET ativo = 1 WHERE id = ?").run(userId);
  db.prepare(
    "INSERT INTO orders (user_id, valor, status, pago_em) VALUES (?, ?, 'manual', datetime('now'))"
  ).run(userId, valor);
});

function ativarAluno(userId, valor) {
  ativarAlunoStmt(userId, valor);
}

function trocarSenha(userId, senhaHash) {
  db.prepare("UPDATE users SET senha_hash = ? WHERE id = ?").run(senhaHash, userId);
}

const trocarSenhaMantendoSessaoStmt = db.transaction((userId, senhaHash, tokenHashAtual) => {
  db.prepare("UPDATE users SET senha_hash = ? WHERE id = ?").run(senhaHash, userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(userId, tokenHashAtual);
});

// Troca a senha do aluno e derruba as sessões dos outros dispositivos, mantendo só a atual.
function trocarSenhaMantendoSessao(userId, senhaHash, tokenHashAtual) {
  trocarSenhaMantendoSessaoStmt(userId, senhaHash, tokenHashAtual);
}

function criarUsuarioInativo(nome, email, whatsapp, senhaHash) {
  const info = db
    .prepare(
      "INSERT INTO users (nome, email, whatsapp, senha_hash, ativo) VALUES (?, ?, ?, ?, 0)"
    )
    .run(nome, email, whatsapp || null, senhaHash);
  return info.lastInsertRowid;
}

function atualizarUsuarioParaCompra(userId, { nome, whatsapp, senhaHash }) {
  db.prepare("UPDATE users SET nome = ?, whatsapp = ?, senha_hash = ? WHERE id = ?").run(
    nome,
    whatsapp || null,
    senhaHash,
    userId
  );
}

function buscarPedidoPorToken(token) {
  return db.prepare("SELECT * FROM orders WHERE token = ?").get(token);
}

function buscarPedidoPorId(id) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
}

function buscarPedidoPendenteValido(userId) {
  return db
    .prepare(
      `SELECT * FROM orders
       WHERE user_id = ? AND status = 'pendente' AND expira_em IS NOT NULL AND expira_em > datetime('now')
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId);
}

function criarPedido(userId, valor, token) {
  const info = db
    .prepare("INSERT INTO orders (user_id, valor, status, token) VALUES (?, ?, 'pendente', ?)")
    .run(userId, valor, token);
  return info.lastInsertRowid;
}

function atualizarPedidoPix(orderId, { mpPaymentId, qrBase64, copiaCola }) {
  db.prepare(
    `UPDATE orders SET mp_payment_id = ?, pix_qr_base64 = ?, pix_copia_cola = ?,
       expira_em = datetime('now', '+30 minutes')
     WHERE id = ?`
  ).run(mpPaymentId, qrBase64, copiaCola, orderId);
}

function marcarLoginFeito(orderId) {
  db.prepare("UPDATE orders SET login_feito = 1 WHERE id = ?").run(orderId);
}

function marcarPedidoExpirado(orderId) {
  db.prepare("UPDATE orders SET status = 'expirado' WHERE id = ? AND status = 'pendente'").run(orderId);
}

const marcarPedidoPagoStmt = db.transaction((orderId) => {
  const pedido = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!pedido || pedido.status === "pago") return;
  db.prepare("UPDATE orders SET status = 'pago', pago_em = datetime('now') WHERE id = ?").run(orderId);
  db.prepare("UPDATE users SET ativo = 1 WHERE id = ?").run(pedido.user_id);
});

function marcarPedidoPago(orderId) {
  marcarPedidoPagoStmt(orderId);
}

const marcarPedidoEstornadoStmt = db.transaction((orderId) => {
  const pedido = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!pedido || pedido.status === "estornado") return;
  db.prepare("UPDATE orders SET status = 'estornado' WHERE id = ?").run(orderId);
  const outroAtivo = db
    .prepare(
      "SELECT 1 FROM orders WHERE user_id = ? AND id != ? AND status IN ('pago', 'manual') LIMIT 1"
    )
    .get(pedido.user_id, orderId);
  if (!outroAtivo) {
    db.prepare("UPDATE users SET ativo = 0 WHERE id = ?").run(pedido.user_id);
  }
});

function marcarPedidoEstornado(orderId) {
  marcarPedidoEstornadoStmt(orderId);
}

function registrarEvento(tipo, detalhe) {
  db.prepare("INSERT INTO eventos (tipo, detalhe) VALUES (?, ?)").run(tipo, detalhe || null);
}

function listarEventosRecentes(limite = 50) {
  return db
    .prepare("SELECT * FROM eventos ORDER BY id DESC LIMIT ?")
    .all(limite);
}

function listarAlunosComPedidos({ incluirTestes = false } = {}) {
  return db
    .prepare(
      `SELECT
         users.id AS user_id, users.nome, users.email, users.whatsapp, users.ativo,
         orders.id AS order_id, orders.valor, orders.status, orders.criado_em, orders.pago_em,
         orders.expira_em
       FROM users
       LEFT JOIN orders ON orders.user_id = users.id
       WHERE ? OR users.is_teste = 0
       ORDER BY users.id DESC, orders.id DESC`
    )
    .all(incluirTestes ? 1 : 0);
}

const registrarDownloadStmt = db.prepare(
  `INSERT INTO progresso (user_id, item, tipo, concluido)
   VALUES (?, ?, 'download', 1)
   ON CONFLICT(user_id, item) DO UPDATE SET concluido = 1, atualizado_em = datetime('now')`
);

function registrarDownload(userId, arquivo) {
  registrarDownloadStmt.run(userId, arquivo);
}

const registrarPassoAulaStmt = db.prepare(
  `INSERT INTO progresso (user_id, item, tipo, passo, total, concluido)
   VALUES (@userId, @item, 'aula', @passo, @total, @concluido)
   ON CONFLICT(user_id, item) DO UPDATE SET
     passo = MAX(passo, excluded.passo),
     total = excluded.total,
     concluido = MAX(concluido, excluded.concluido),
     atualizado_em = datetime('now')`
);

function registrarPassoAula(userId, arquivo, passo, total) {
  registrarPassoAulaStmt.run({
    userId,
    item: arquivo,
    passo,
    total,
    concluido: passo >= total ? 1 : 0,
  });
}

function progressoDoAluno(userId) {
  const linhas = db.prepare("SELECT * FROM progresso WHERE user_id = ?").all(userId);
  const mapa = new Map();
  for (const linha of linhas) mapa.set(linha.item, linha);
  return mapa;
}

function resumoProgresso({ incluirTestes = false } = {}) {
  return db
    .prepare(
      `SELECT item, tipo,
         COUNT(DISTINCT user_id) AS alunos,
         COALESCE(SUM(concluido), 0) AS concluidos
       FROM progresso
       JOIN users ON users.id = progresso.user_id
       WHERE ? OR users.is_teste = 0
       GROUP BY item, tipo`
    )
    .all(incluirTestes ? 1 : 0);
}

const salvarAvaliacaoStmt = db.prepare(
  `INSERT INTO avaliacoes (user_id, etapa, nota, comentario, pode_divulgar)
   VALUES (@userId, @etapa, @nota, @comentario, @podeDivulgar)
   ON CONFLICT(user_id, etapa) DO UPDATE SET
     nota = excluded.nota,
     comentario = excluded.comentario,
     pode_divulgar = excluded.pode_divulgar,
     atualizado_em = datetime('now')`
);

function salvarAvaliacao(userId, etapa, nota, comentario, podeDivulgar) {
  salvarAvaliacaoStmt.run({
    userId,
    etapa,
    nota,
    comentario,
    podeDivulgar: podeDivulgar ? 1 : 0,
  });
}

function avaliacoesDoAluno(userId) {
  const etapas = db.prepare("SELECT etapa FROM avaliacoes WHERE user_id = ?").all(userId).map((l) => l.etapa);
  return { intermediaria: etapas.includes("intermediaria"), final: etapas.includes("final") };
}

function resumoAvaliacoes({ incluirTestes = false } = {}) {
  const linhas = db
    .prepare(
      `SELECT etapa, nota, COUNT(*) AS n FROM avaliacoes
       JOIN users ON users.id = avaliacoes.user_id
       WHERE ? OR users.is_teste = 0
       GROUP BY etapa, nota`
    )
    .all(incluirTestes ? 1 : 0);
  const resumo = {};
  for (const etapa of ["intermediaria", "final"]) {
    const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let respostas = 0;
    let soma = 0;
    for (const l of linhas) {
      if (l.etapa !== etapa) continue;
      distribuicao[l.nota] = l.n;
      respostas += l.n;
      soma += l.nota * l.n;
    }
    resumo[etapa] = { respostas, media: respostas ? soma / respostas : null, distribuicao };
  }
  return resumo;
}

function listarAvaliacoes({ incluirTestes = false } = {}) {
  return db
    .prepare(
      `SELECT users.nome, users.email, avaliacoes.etapa, avaliacoes.nota, avaliacoes.comentario,
         avaliacoes.pode_divulgar, avaliacoes.criado_em, avaliacoes.atualizado_em
       FROM avaliacoes
       JOIN users ON users.id = avaliacoes.user_id
       WHERE ? OR users.is_teste = 0
       ORDER BY avaliacoes.atualizado_em DESC, users.id DESC`
    )
    .all(incluirTestes ? 1 : 0);
}

function contarAlunosAtivos({ incluirTestes = false } = {}) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE ativo = 1 AND (? OR is_teste = 0)")
    .get(incluirTestes ? 1 : 0).n;
}

function resumoVendas({ incluirTestes = false } = {}) {
  return db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status IN ('pago', 'manual') THEN 1 END) AS total_pagos,
         COALESCE(SUM(CASE WHEN status IN ('pago', 'manual') THEN valor END), 0) AS soma,
         COUNT(CASE WHEN status = 'pendente' THEN 1 END) AS pendentes
       FROM orders
       JOIN users ON users.id = orders.user_id
       WHERE ? OR users.is_teste = 0`
    )
    .get(incluirTestes ? 1 : 0);
}

module.exports = {
  db,
  ping,
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  criarSessao,
  destruirSessao,
  buscarUsuarioPorSessao,
  criarAlunoAtivo,
  criarAlunoManual,
  ativarAluno,
  trocarSenha,
  trocarSenhaMantendoSessao,
  criarUsuarioInativo,
  atualizarUsuarioParaCompra,
  buscarPedidoPorToken,
  buscarPedidoPorId,
  buscarPedidoPendenteValido,
  criarPedido,
  atualizarPedidoPix,
  marcarLoginFeito,
  marcarPedidoExpirado,
  marcarPedidoPago,
  marcarPedidoEstornado,
  registrarEvento,
  listarEventosRecentes,
  listarAlunosComPedidos,
  resumoVendas,
  registrarDownload,
  registrarPassoAula,
  progressoDoAluno,
  resumoProgresso,
  salvarAvaliacao,
  avaliacoesDoAluno,
  resumoAvaliacoes,
  listarAvaliacoes,
  contarAlunosAtivos,
};
