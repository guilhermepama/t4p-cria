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

function ping() {
  return db.prepare("SELECT 1 AS ok").get().ok === 1;
}

module.exports = { db, ping };
