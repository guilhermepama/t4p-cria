"use strict";

const crypto = require("crypto");
const db = require("./db");

const SESSION_COOKIE = "t4p_sess";
const SESSION_DIAS = 30;

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEYLEN = 64;

function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const chave = crypto.scryptSync(senha, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  return `scrypt$${salt.toString("hex")}$${chave.toString("hex")}`;
}

function verificarSenha(senha, hashArmazenado) {
  const partes = String(hashArmazenado || "").split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const salt = Buffer.from(partes[1], "hex");
  const chaveEsperada = Buffer.from(partes[2], "hex");
  const chaveObtida = crypto.scryptSync(senha, salt, chaveEsperada.length, SCRYPT_OPTS);
  return crypto.timingSafeEqual(chaveObtida, chaveEsperada);
}

function sha256(texto) {
  return crypto.createHash("sha256").update(texto).digest("hex");
}

function tokenHashDaSessao(req) {
  const token = req.cookies[SESSION_COOKIE];
  return token ? sha256(token) : null;
}

function criarSessaoCookie(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + SESSION_DIAS * 24 * 60 * 60 * 1000);
  db.criarSessao(sha256(token), userId, expiraEm.toISOString());
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DIAS * 24 * 60 * 60 * 1000,
  });
}

function destruirSessaoCookie(req, res) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) db.destruirSessao(sha256(token));
  res.clearCookie(SESSION_COOKIE);
}

function caminhoRelativoSeguro(caminho) {
  if (typeof caminho !== "string") return null;
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return null;
  if (caminho.includes("://")) return null;
  return caminho;
}

function requireAluno(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  const volta = caminhoRelativoSeguro(req.originalUrl) || "/aluno";
  if (!token) return res.redirect(`/entrar?volta=${encodeURIComponent(volta)}`);
  const usuario = db.buscarUsuarioPorSessao(sha256(token));
  if (!usuario || !usuario.ativo) {
    return res.redirect(`/entrar?volta=${encodeURIComponent(volta)}`);
  }
  req.aluno = usuario;
  next();
}

function requireAdmin(req, res, next) {
  const adminUser = process.env.ADMIN_USER || "";
  const adminPass = process.env.ADMIN_PASS || "";
  if (!adminUser || !adminPass) {
    return res.status(503).send("Admin não configurado.");
  }

  const cabecalho = req.headers.authorization || "";
  const [tipo, credenciais] = cabecalho.split(" ");
  if (tipo !== "Basic" || !credenciais) {
    res.set("WWW-Authenticate", "Basic realm=\"t4p-admin\"");
    return res.status(401).send("Autenticação necessária.");
  }

  const decoded = Buffer.from(credenciais, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const usuario = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const senha = idx >= 0 ? decoded.slice(idx + 1) : "";

  const usuarioOk = compararSeguro(usuario, adminUser);
  const senhaOk = compararSeguro(senha, adminPass);
  if (!usuarioOk || !senhaOk) {
    res.set("WWW-Authenticate", "Basic realm=\"t4p-admin\"");
    return res.status(401).send("Credenciais inválidas.");
  }
  next();
}

function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checarOrigem(req, res, next) {
  if (req.path === "/webhooks/mp") return next();
  const baseUrl = process.env.BASE_URL || "";
  const origem = req.headers.origin || req.headers.referer || "";
  let origemHost;
  try {
    origemHost = new URL(origem).origin;
  } catch {
    return res.status(403).send("Origem inválida.");
  }
  let baseHost;
  try {
    baseHost = new URL(baseUrl).origin;
  } catch {
    return res.status(403).send("BASE_URL não configurada.");
  }
  if (origemHost !== baseHost) {
    return res.status(403).send("Origem inválida.");
  }
  next();
}

module.exports = {
  SESSION_COOKIE,
  hashSenha,
  verificarSenha,
  tokenHashDaSessao,
  criarSessaoCookie,
  destruirSessaoCookie,
  caminhoRelativoSeguro,
  requireAluno,
  requireAdmin,
  checarOrigem,
};
