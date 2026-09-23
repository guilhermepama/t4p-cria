"use strict";

const db = require("../src/db");
const auth = require("../src/auth");

const [nome, email, senha, whatsapp] = process.argv.slice(2);

if (!nome || !email || !senha) {
  console.error("Uso: npm run criar-aluno -- \"Nome\" email@exemplo.com senha123 [whatsapp]");
  process.exit(1);
}

if (senha.length < 8) {
  console.error("A senha precisa ter ao menos 8 caracteres.");
  process.exit(1);
}

try {
  const id = db.criarAlunoAtivo(nome, email, auth.hashSenha(senha), whatsapp);
  console.log(`Aluno criado e ativo: id=${id}, email=${email}`);
} catch (erro) {
  if (String(erro.message).includes("UNIQUE")) {
    console.error(`Já existe um aluno com o e-mail ${email}.`);
    process.exit(1);
  }
  throw erro;
}
