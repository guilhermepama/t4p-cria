"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "t4p.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
`);

function migrar() {
  const colunasOrders = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!colunasOrders.includes("login_feito")) {
    db.exec("ALTER TABLE orders ADD COLUMN login_feito INTEGER NOT NULL DEFAULT 0");
  }
}
migrar();

db.prepare("DELETE FROM sessions WHERE expira_em <= datetime('now')").run();

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

function listarAlunosComPedidos() {
  return db
    .prepare(
      `SELECT
         users.id AS user_id, users.nome, users.email, users.whatsapp, users.ativo,
         orders.id AS order_id, orders.valor, orders.status, orders.criado_em, orders.pago_em,
         orders.expira_em
       FROM users
       LEFT JOIN orders ON orders.user_id = users.id
       ORDER BY users.id DESC, orders.id DESC`
    )
    .all();
}

function resumoVendas() {
  return db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status IN ('pago', 'manual') THEN 1 END) AS total_pagos,
         COALESCE(SUM(CASE WHEN status IN ('pago', 'manual') THEN valor END), 0) AS soma,
         COUNT(CASE WHEN status = 'pendente' THEN 1 END) AS pendentes
       FROM orders`
    )
    .get();
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
};
