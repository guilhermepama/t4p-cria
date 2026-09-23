"use strict";

// Testa o fluxo completo num navegador real (Chromium), clicando nos
// formulários de verdade — sem page.request e sem cabeçalhos montados à
// mão. É este teste que teria pego o bug do "Origin: null" (curl não pega,
// porque curl não aplica Referrer-Policy).
//
// Uso: npm run e2e

const path = require("path");
const os = require("os");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const mpFake = require("./mp-fake");

const RAIZ = path.join(__dirname, "..");

const ADMIN_USER = "admin-e2e";
const ADMIN_PASS = "senha-admin-e2e-12345";
const PRECO = "49.90";
const PRECO_BRL = "49,90";
const PRECO_NUM = 49.9;
const SUFIXO = Date.now();
const ALUNO_MANUAL = {
  nome: "Aluno Manual E2E",
  email: `aluno.manual.${SUFIXO}@exemplo.com`,
  whatsapp: "11999990001",
  senha: "senha-aluno-e2e",
  valor: "49,90",
};
const ALUNO_PIX = {
  nome: "Aluno Pix E2E",
  email: `aluno.pix.${SUFIXO}@exemplo.com`,
  whatsapp: "11999990002",
  senha: "senha-pix-e2e-1234",
};

const passos = [];
let falhou = false;

async function passo(nome, fn) {
  try {
    await fn();
    passos.push({ nome, ok: true });
    console.log(`✅ ${nome}`);
  } catch (erro) {
    falhou = true;
    passos.push({ nome, ok: false, erro });
    console.log(`❌ ${nome}`);
    console.log(`   ${erro.stack || erro.message || erro}`);
  }
}

function portaLivre(preferida) {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.unref();
    servidor.on("error", () => resolve(portaLivre(preferida + 1)));
    servidor.listen(preferida, "127.0.0.1", () => {
      const { port } = servidor.address();
      servidor.close(() => resolve(port));
    });
  });
}

async function esperarSaudavel(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url} a tempo.`);
}

async function continuarQuandoLiberado(pagina) {
  await pagina.waitForFunction(() => !document.getElementById("continuar").disabled);
  await pagina.click("#continuar");
}

// A Aula 1 é uma lição de uma página só, com passos que só liberam o botão
// "Continuar" depois de uma pequena interação (data-trava). Isto reproduz
// essas interações com cliques reais, na ordem em que os passos aparecem,
// só para conseguir chegar ao cartão final "Próxima: Aula 2".
async function percorrerAula1(pagina) {
  await pagina.click("#comecar"); // hero -> introdução 1
  await continuarQuandoLiberado(pagina); // introdução 1 -> introdução 2
  await continuarQuandoLiberado(pagina); // introdução 2 -> introdução 3
  await continuarQuandoLiberado(pagina); // introdução 3 -> passo "pedido genérico"

  await pagina.click("#ver-generica");
  await continuarQuandoLiberado(pagina); // -> passo "previsão de palavras"

  await pagina.locator('[data-r="1"]').first().click();
  await pagina.locator("#rodada-2:not(.oculto)").waitFor();
  await pagina.locator('[data-r="2"]').first().click();
  await continuarQuandoLiberado(pagina); // -> passo "o estagiário sem contexto"

  const itensEstagiario = pagina.locator("#lista-estagiario .item");
  const totalItens = await itensEstagiario.count();
  for (let i = 0; i < totalItens; i++) {
    await itensEstagiario.nth(i).click();
  }
  await continuarQuandoLiberado(pagina); // -> passo "método CAFÉ"

  const letrasCafe = pagina.locator(".letras .letra");
  const totalLetras = await letrasCafe.count();
  for (let i = 0; i < totalLetras; i++) {
    await letrasCafe.nth(i).click();
  }
  await continuarQuandoLiberado(pagina); // -> passo "monte seu pedido"

  const ingredientes = pagina.locator("#ingredientes .btn-linha");
  const totalIngredientes = await ingredientes.count();
  for (let i = 0; i < totalIngredientes; i++) {
    await ingredientes.nth(i).click();
  }
  await pagina.locator("#ver-cafe:not([disabled])").waitFor();
  await pagina.click("#ver-cafe");
  await continuarQuandoLiberado(pagina); // -> passo "pratique o seu pedido" (livre)

  await continuarQuandoLiberado(pagina); // -> quiz

  for (const letraCerta of ["C", "F", "A"]) {
    await pagina.locator(`#quiz-letras .letra[data-q="${letraCerta}"]`).click();
    const proxima = pagina.locator("#quiz-proxima");
    if (!(await proxima.evaluate((el) => el.classList.contains("oculto")))) {
      await proxima.click();
    }
  }
  await continuarQuandoLiberado(pagina); // -> cartão final
}

// Sobe uma instância própria do app (porta/banco à parte), reaproveitando o
// mesmo mp-fake. Usado só pelo teste de encerramento de vendas, que precisa
// reiniciar o servidor com um VENDAS_ATE diferente sobre o mesmo banco.
async function iniciarApp(fakePort, dbPath, extraEnv) {
  const porta = await portaLivre(3395);
  const baseUrl = `http://127.0.0.1:${porta}`;

  const processo = spawn(process.execPath, [path.join(RAIZ, "src", "server.js")], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORT: String(porta),
      DB_PATH: dbPath,
      BASE_URL: baseUrl,
      NODE_ENV: "test",
      TRUST_PROXY: "0",
      MP_ACCESS_TOKEN: "TEST-fake-access-token",
      MP_WEBHOOK_SECRET: "segredo-e2e",
      MP_API_URL: `http://127.0.0.1:${fakePort}`,
      PRECO,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processo.stdout.on("data", (d) => process.stdout.write(`[app-vendas] ${d}`));
  processo.stderr.on("data", (d) => process.stderr.write(`[app-vendas] ${d}`));
  await esperarSaudavel(`${baseUrl}/health`);

  return { processo, baseUrl };
}

async function abrirChromium() {
  const tentativas = [{ channel: "chrome" }, { channel: "msedge" }, {}];
  let ultimoErro;
  for (const opcoes of tentativas) {
    try {
      return await chromium.launch({ headless: true, ...opcoes });
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw new Error(
    `Não achei um Chromium para rodar (Chrome/Edge do sistema nem o do Playwright). ` +
      `Rode "npx playwright install chromium" e tente de novo.\n${ultimoErro}`
  );
}

async function main() {
  const dirTemp = fs.mkdtempSync(path.join(os.tmpdir(), "t4p-e2e-"));
  const dbPath = path.join(dirTemp, "t4p.db");

  const fakePort = await portaLivre(3391);
  const appPort = await portaLivre(3392);
  const baseUrl = `http://127.0.0.1:${appPort}`;

  mpFake.server.listen(fakePort);

  const appProcess = spawn(
    process.execPath,
    [path.join(RAIZ, "src", "server.js")],
    {
      cwd: RAIZ,
      env: {
        ...process.env,
        PORT: String(appPort),
        DB_PATH: dbPath,
        BASE_URL: baseUrl,
        NODE_ENV: "test",
        TRUST_PROXY: "0",
        MP_ACCESS_TOKEN: "TEST-fake-access-token",
        MP_WEBHOOK_SECRET: "segredo-e2e",
        MP_API_URL: `http://127.0.0.1:${fakePort}`,
        PRECO,
        ADMIN_USER,
        ADMIN_PASS,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  appProcess.stdout.on("data", (d) => process.stdout.write(`[app] ${d}`));
  appProcess.stderr.on("data", (d) => process.stderr.write(`[app] ${d}`));

  let browser;
  try {
    await esperarSaudavel(`${baseUrl}/health`);
    browser = await abrirChromium();

    // ---------- 0) a landing e o /comprar mostram o preço de lançamento (fonte única) ----------
    await passo(`GET / e /comprar mostram o preço de lançamento (R$ ${PRECO_BRL})`, async () => {
      const respLanding = await fetch(`${baseUrl}/`);
      const htmlLanding = await respLanding.text();
      if (!htmlLanding.includes(`R$ ${PRECO_BRL}`) && !htmlLanding.includes(`>${PRECO_BRL}<`) && !htmlLanding.includes(`>${PRECO_BRL}`)) {
        throw new Error(`landing não mostra o preço ${PRECO_BRL}`);
      }
      if (htmlLanding.includes("{{preco_brl}}")) {
        throw new Error("marcador {{preco_brl}} não foi substituído na landing");
      }
      if (/\bR\$\s*97\b/.test(htmlLanding)) {
        throw new Error("landing ainda mostra o preço antigo (R$ 97)");
      }

      const respComprar = await fetch(`${baseUrl}/comprar`);
      const htmlComprar = await respComprar.text();
      if (!htmlComprar.includes(`R$ ${PRECO_BRL}`)) {
        throw new Error(`/comprar não mostra o preço ${PRECO_BRL}`);
      }
    });

    // ---------- 0b) a landing tem os links de WhatsApp (fonte única, sem WHATSAPP na env → padrão) ----------
    await passo("landing tem pelo menos 3 links wa.me/5519974139426 e nenhum {{whatsapp sobra", async () => {
      const pagina = await browser.newPage();
      await pagina.goto(`${baseUrl}/`);
      const htmlRenderizado = await pagina.content();
      const links = htmlRenderizado.match(/wa\.me\/5519974139426/g) || [];
      if (links.length < 3) {
        throw new Error(`landing tem só ${links.length} link(s) wa.me/5519974139426, esperava pelo menos 3`);
      }
      if (htmlRenderizado.includes("{{whatsapp")) {
        throw new Error("marcador {{whatsapp... não foi substituído na landing");
      }
      await pagina.close();
    });

    // ---------- 0c) og:image responde 200 e é servido como image/jpeg ----------
    await passo("landing tem meta og:image apontando para um arquivo que responde 200", async () => {
      const htmlLanding = await (await fetch(`${baseUrl}/`)).text();
      const match = htmlLanding.match(/<meta property="og:image" content="([^"]+)">/);
      if (!match) {
        throw new Error("landing não tem a meta og:image");
      }
      const caminho = new URL(match[1]).pathname;
      const respImagem = await fetch(`${baseUrl}${caminho}`);
      if (respImagem.status !== 200) {
        throw new Error(`og:image (${caminho}) respondeu ${respImagem.status}`);
      }
      const tipo = respImagem.headers.get("content-type") || "";
      if (!tipo.includes("image/jpeg")) {
        throw new Error(`og:image (${caminho}) veio com content-type "${tipo}", esperava image/jpeg`);
      }
    });

    // ---------- 0d) favicon responde 200 e o link[rel=icon] existe na landing ----------
    // (o /aluno é conferido mais abaixo, no passo que já loga com o aluno manual)
    await passo("favicon.ico responde 200 e link[rel=icon] existe na landing", async () => {
      const respFavicon = await fetch(`${baseUrl}/favicon.ico`);
      if (respFavicon.status !== 200) {
        throw new Error(`/favicon.ico respondeu ${respFavicon.status}`);
      }

      const paginaLanding = await browser.newPage();
      await paginaLanding.goto(`${baseUrl}/`);
      const temIconLanding = (await paginaLanding.locator('link[rel="icon"]').count()) > 0;
      await paginaLanding.close();
      if (!temIconLanding) {
        throw new Error("landing não tem link[rel=icon]");
      }
    });

    // ---------- 0e) header da landing: link "Entrar" (desktop 1280 e mobile 360/390, sem scroll horizontal) ----------
    await passo(
      "landing: link 'Entrar' do header leva a /entrar (desktop 1280 e mobile 360/390, sem scroll horizontal)",
      async () => {
        const evidenciasDir = path.join(RAIZ, "docs", "claude-bridge", "evidencias");
        fs.mkdirSync(evidenciasDir, { recursive: true });

        const viewports = [
          { nome: "desktop-1280", width: 1280, height: 900 },
          { nome: "mobile-360", width: 360, height: 780 },
          { nome: "mobile-390", width: 390, height: 844 },
        ];

        for (const viewport of viewports) {
          const pagina = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
          await pagina.goto(`${baseUrl}/`);

          const href = await pagina.locator(".header-login").getAttribute("href");
          if (href !== "/entrar") {
            throw new Error(`link "Entrar" do header (${viewport.nome}) aponta para "${href}", esperava "/entrar"`);
          }

          if (viewport.width === 360) {
            const semScrollHorizontal = await pagina.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
            );
            if (!semScrollHorizontal) {
              throw new Error("header em 360px provoca scroll horizontal (documentElement.scrollWidth > clientWidth)");
            }
          }

          await pagina.screenshot({ path: path.join(evidenciasDir, `tarefa-08-header-${viewport.nome}.png`) });
          await pagina.close();
        }
      }
    );

    // ---------- 0f) /entrar (GET): link "Esqueci minha senha" presente ----------
    await passo('/entrar (GET): link "Esqueci minha senha" presente com href wa.me esperado', async () => {
      const pagina = await browser.newPage();
      await pagina.goto(`${baseUrl}/entrar`);
      const href = await pagina.locator("#esqueci-link").getAttribute("href");
      if (!href || !href.startsWith("https://wa.me/5519974139426?text=")) {
        throw new Error(`href do link "Esqueci minha senha" (GET) inesperado: "${href}"`);
      }
      await pagina.close();
    });

    // ---------- 0g) /entrar: com e-mail digitado, o link passa a conter o e-mail ----------
    await passo('/entrar: com e-mail digitado, o link "Esqueci minha senha" passa a conter o e-mail', async () => {
      const pagina = await browser.newPage();
      await pagina.goto(`${baseUrl}/entrar`);
      const emailTeste = "cliente.teste@exemplo.com";
      await pagina.fill("#email", emailTeste);

      // O link abre uma aba nova (target=_blank) para o wa.me; não esperamos o
      // carregamento dela (pode não haver internet no ambiente de teste). Lemos
      // o href do próprio link depois do clique, como sugerido na validação.
      const popupPromise = pagina.context().waitForEvent("page").catch(() => null);
      await pagina.click("#esqueci-link");
      const hrefFinal = await pagina.locator("#esqueci-link").getAttribute("href");
      const popup = await popupPromise;
      if (popup) await popup.close();

      if (!hrefFinal || !hrefFinal.includes(encodeURIComponent(emailTeste))) {
        throw new Error(`href do link "Esqueci minha senha" não contém o e-mail digitado: "${hrefFinal}"`);
      }
      await pagina.close();
    });

    // ---------- 0h) /comprar tem link para /entrar ----------
    await passo("/comprar tem link para /entrar", async () => {
      const html = await (await fetch(`${baseUrl}/comprar`)).text();
      if (!/href="\/entrar"/.test(html)) {
        throw new Error("/comprar não tem link para /entrar");
      }
    });

    // ---------- a) /admin cadastra aluno manual com valor "49,90" ----------
    const ctxAdmin = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const paginaAdmin = await ctxAdmin.newPage();

    await passo(`/admin cadastra aluno manual com valor ${ALUNO_MANUAL.valor} (vírgula)`, async () => {
      await paginaAdmin.goto(`${baseUrl}/admin`);
      await paginaAdmin.fill("#nome", ALUNO_MANUAL.nome);
      await paginaAdmin.fill("#email", ALUNO_MANUAL.email);
      await paginaAdmin.fill("#whatsapp", ALUNO_MANUAL.whatsapp);
      await paginaAdmin.fill("#senha", ALUNO_MANUAL.senha);
      await paginaAdmin.fill("#valor", ALUNO_MANUAL.valor);
      await paginaAdmin.click('button:has-text("Cadastrar aluno")');
      await paginaAdmin.waitForURL(`${baseUrl}/admin`);
      const corpo = await paginaAdmin.content();
      if (!corpo.includes(ALUNO_MANUAL.email)) {
        throw new Error("aluno cadastrado não aparece na tabela do /admin");
      }
      if (!corpo.includes("R$")) {
        throw new Error("valor não aparece formatado na tabela do /admin");
      }
    });

    const EMAIL_LONGO = `aluno.com.nome.bem.longo.${SUFIXO}@exemplo-longo.com`;

    await passo("/admin: e-mail de 40+ caracteres não invade a coluna do WhatsApp", async () => {
      await paginaAdmin.fill("#nome", "Aluno Email Longo E2E");
      await paginaAdmin.fill("#email", EMAIL_LONGO);
      await paginaAdmin.fill("#whatsapp", "11999990003");
      await paginaAdmin.fill("#senha", "senha-email-longo-e2e");
      await paginaAdmin.fill("#valor", ALUNO_MANUAL.valor);
      await paginaAdmin.click('button:has-text("Cadastrar aluno")');
      await paginaAdmin.waitForURL(`${baseUrl}/admin`);

      if (EMAIL_LONGO.length < 40) {
        throw new Error("o e-mail de teste precisa ter pelo menos 40 caracteres");
      }

      const linha = paginaAdmin.locator("tr", { hasText: EMAIL_LONGO });
      const celulaEmail = linha.locator("td").nth(1);
      const semEstouro = await celulaEmail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      if (!semEstouro) {
        throw new Error("a célula do e-mail estoura a largura da coluna (invade o WhatsApp)");
      }

      const evidenciasDir = path.join(RAIZ, "docs", "claude-bridge", "evidencias");
      fs.mkdirSync(evidenciasDir, { recursive: true });
      await linha.scrollIntoViewIfNeeded();
      await paginaAdmin.screenshot({
        path: path.join(evidenciasDir, "tarefa-05-admin-email-longo.png"),
      });
    });
    await ctxAdmin.close();

    // ---------- 0i) /entrar (401 senha errada): link "Esqueci minha senha" presente ----------
    await passo('/entrar (401 senha errada): link "Esqueci minha senha" presente', async () => {
      const pagina = await browser.newPage();
      await pagina.goto(`${baseUrl}/entrar`);
      const respPromise = pagina.waitForResponse(
        (r) => r.url() === `${baseUrl}/entrar` && r.request().method() === "POST"
      );
      await pagina.fill("#email", ALUNO_MANUAL.email);
      await pagina.fill("#senha", "senha-completamente-errada");
      await pagina.click('button:has-text("Entrar")');
      const resp = await respPromise;
      if (resp.status() !== 401) {
        throw new Error(`POST /entrar com senha errada respondeu ${resp.status()}, esperava 401`);
      }
      const href = await pagina.locator("#esqueci-link").getAttribute("href");
      if (!href || !href.startsWith("https://wa.me/5519974139426?text=")) {
        throw new Error(`href do link "Esqueci minha senha" (401) inesperado: "${href}"`);
      }
      await pagina.close();
    });

    // ---------- 0j) /entrar (403 inativo): link "Esqueci minha senha" presente ----------
    const EMAIL_INATIVO = `aluno.inativo.${SUFIXO}@exemplo.com`;
    const SENHA_INATIVO = "senha-inativo-e2e-1234";

    await passo("cria usuário inativo (via /comprar, sem pagar) para o teste do /entrar 403", async () => {
      const ctx = await browser.newContext();
      const pagina = await ctx.newPage();
      await pagina.goto(`${baseUrl}/comprar`);
      await pagina.fill("#nome", "Aluno Inativo E2E");
      await pagina.fill("#email", EMAIL_INATIVO);
      await pagina.fill("#whatsapp", "11999990099");
      await pagina.fill("#senha", SENHA_INATIVO);
      await pagina.check('input[name="aceite"]');
      await pagina.click('button:has-text("Gerar PIX")');
      await pagina.waitForURL(/\/pagamento\//);
      await ctx.close();
    });

    await passo('/entrar (403 inativo): link "Esqueci minha senha" presente', async () => {
      const pagina = await browser.newPage();
      await pagina.goto(`${baseUrl}/entrar`);
      const respPromise = pagina.waitForResponse(
        (r) => r.url() === `${baseUrl}/entrar` && r.request().method() === "POST"
      );
      await pagina.fill("#email", EMAIL_INATIVO);
      await pagina.fill("#senha", SENHA_INATIVO);
      await pagina.click('button:has-text("Entrar")');
      const resp = await respPromise;
      if (resp.status() !== 403) {
        throw new Error(`POST /entrar com usuário inativo respondeu ${resp.status()}, esperava 403`);
      }
      const href = await pagina.locator("#esqueci-link").getAttribute("href");
      if (!href || !href.startsWith("https://wa.me/5519974139426?text=")) {
        throw new Error(`href do link "Esqueci minha senha" (403) inesperado: "${href}"`);
      }
      await pagina.close();
    });

    // ---------- b) /entrar com esse aluno, abre Aula 1, vai para Aula 2 ----------
    // reducedMotion: a Aula 1 é uma lição interativa com animações/digitação
    // por passo; isso faz o próprio conteúdo pular direto pro estado final
    // de cada passo, sem mudar o que é preciso clicar para destravar cada um.
    const ctxAluno = await browser.newContext({ reducedMotion: "reduce" });
    const paginaAluno = await ctxAluno.newPage();

    await passo("/entrar com o aluno manual → /aluno → Aula 1 → Aula 2", async () => {
      await paginaAluno.goto(`${baseUrl}/entrar`);
      await paginaAluno.fill("#email", ALUNO_MANUAL.email);
      await paginaAluno.fill("#senha", ALUNO_MANUAL.senha);
      await paginaAluno.click('button:has-text("Entrar")');
      await paginaAluno.waitForURL(`${baseUrl}/aluno`);
      const titulo = await paginaAluno.locator("h1").textContent();
      if (!titulo || !titulo.includes(ALUNO_MANUAL.nome)) {
        throw new Error("página /aluno não mostrou o nome do aluno logado");
      }
      if ((await paginaAluno.locator('link[rel="icon"]').count()) === 0) {
        throw new Error("/aluno não tem link[rel=icon]");
      }

      const [aula1] = await Promise.all([
        ctxAluno.waitForEvent("page"),
        paginaAluno.getByRole("link", { name: "Abrir aula" }).first().click(),
      ]);
      await aula1.waitForLoadState();
      if (!aula1.url().includes("Aula1_O_Pedido_que_Funciona.html")) {
        throw new Error("clique em 'Abrir aula' não abriu a Aula 1");
      }

      await percorrerAula1(aula1);

      await aula1.getByRole("link", { name: "Ir para a Aula 2" }).click();
      await aula1.waitForURL(/Aula2_Conserte_a_Resposta\.html/);
      await aula1.close();
    });
    await ctxAluno.close();

    // ---------- c) /comprar → paga no mp-fake → cai sozinho em /aluno ----------
    const ctxCompra = await browser.newContext();
    const paginaCompra = await ctxCompra.newPage();

    await passo(
      "/comprar → /pagamento mostra QR → aprovado no mp-fake → cai em /aluno sozinho",
      async () => {
        await paginaCompra.goto(`${baseUrl}/comprar`);
        await paginaCompra.fill("#nome", ALUNO_PIX.nome);
        await paginaCompra.fill("#email", ALUNO_PIX.email);
        await paginaCompra.fill("#whatsapp", ALUNO_PIX.whatsapp);
        await paginaCompra.fill("#senha", ALUNO_PIX.senha);
        await paginaCompra.check('input[name="aceite"]');
        await paginaCompra.click('button:has-text("Gerar PIX")');
        await paginaCompra.waitForURL(/\/pagamento\//);

        const token = new URL(paginaCompra.url()).pathname.split("/")[2];
        const qrSrc = await paginaCompra.locator("img.qr").getAttribute("src");
        if (!qrSrc || !qrSrc.startsWith("data:image")) {
          throw new Error("/pagamento não mostrou o QR Code");
        }
        const copiaCola = await paginaCompra.locator("#copiaCola").inputValue();
        if (!copiaCola) {
          throw new Error("/pagamento não mostrou o copia-e-cola");
        }

        // Extrai o id do pagamento fake do copia-e-cola em vez de supor "1000":
        // o teste do usuário inativo (para o /entrar 403) já consumiu um pedido
        // antes deste, então o próximo id da sequência do mp-fake não é fixo.
        const matchId = copiaCola.match(/PIXFAKE(\d+)/);
        if (!matchId) {
          throw new Error("não consegui extrair o id do pagamento fake do copia-e-cola");
        }
        const idPagamentoFake = matchId[1];

        // Aprova o pagamento no servidor falso do MP (é o MP real quem faria
        // isso; não existe formulário no nosso app para simular isso).
        const respAprovar = await fetch(`http://127.0.0.1:${fakePort}/__set/${idPagamentoFake}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        });
        if (!respAprovar.ok) {
          throw new Error(`mp-fake não aceitou a aprovação (status ${respAprovar.status})`);
        }

        // Confere que o valor cobrado no MP é exatamente o preço mostrado na
        // landing/comprar (mesma fonte).
        const pagamentoFake = await (
          await fetch(`http://127.0.0.1:${fakePort}/v1/payments/${idPagamentoFake}`)
        ).json();
        if (pagamentoFake.transaction_amount !== PRECO_NUM) {
          throw new Error(
            `valor cobrado no mp-fake (${pagamentoFake.transaction_amount}) diferente do preço mostrado (${PRECO_NUM})`
          );
        }

        // A própria página, pelo polling, detecta o pagamento e navega sozinha.
        await paginaCompra.waitForURL((url) => url.pathname === "/aluno", { timeout: 20000 });
        const titulo = await paginaCompra.locator("h1").textContent();
        if (!titulo || !titulo.includes(ALUNO_PIX.nome)) {
          throw new Error("não caiu na área do aluno certo depois do pagamento");
        }
        void token;
      }
    );

    // ---------- d) /sair funciona ----------
    await passo("/sair encerra a sessão e volta para /entrar", async () => {
      await paginaCompra.click('button:has-text("Sair")');
      await paginaCompra.waitForURL(`${baseUrl}/entrar`);
    });
    await ctxCompra.close();

    // ---------- e) eventos: sem mp_ignorado "pending", e mp_aprovado com origem= ----------
    const ctxEventos = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const paginaEventos = await ctxEventos.newPage();

    await passo("eventos: sem mp_ignorado pending repetido, e mp_aprovado registra origem=", async () => {
      await paginaEventos.goto(`${baseUrl}/admin`);
      const corpo = await paginaEventos.content();
      if (/mp_ignorado[^<]*status=pending/.test(corpo)) {
        throw new Error("o polling ainda registra mp_ignorado para status pending");
      }
      if (!/mp_aprovado[^<]*origem=polling/.test(corpo)) {
        throw new Error("o evento mp_aprovado não registra origem=polling");
      }
    });
    await ctxEventos.close();

    // ---------- f) encerramento automático das vendas (VENDAS_ATE) ----------
    await passo(
      "VENDAS_ATE no passado: /comprar responde 410, nada é gravado, e o pedido criado antes continua sendo processado",
      async () => {
        const dirVendas = fs.mkdtempSync(path.join(os.tmpdir(), "t4p-e2e-vendas-"));
        const dbVendas = path.join(dirVendas, "t4p.db");
        const ADMIN_USER_V = "admin-vendas-e2e";
        const ADMIN_PASS_V = "senha-admin-vendas-e2e-12345";
        const EMAIL_FUTURO = `aluno.vendas.futuro.${SUFIXO}@exemplo.com`;
        const EMAIL_BLOQUEADO = `aluno.vendas.bloqueado.${SUFIXO}@exemplo.com`;

        try {
          // com VENDAS_ATE no futuro, o checkout funciona normalmente e cria um pedido pendente
          let token;
          let idPagamentoFake;
          const appFuturo = await iniciarApp(fakePort, dbVendas, {
            VENDAS_ATE: "2026-12-31T23:59:59-03:00",
            ADMIN_USER: ADMIN_USER_V,
            ADMIN_PASS: ADMIN_PASS_V,
          });
          try {
            const ctx = await browser.newContext();
            const pagina = await ctx.newPage();
            await pagina.goto(`${appFuturo.baseUrl}/comprar`);
            await pagina.fill("#nome", "Aluno Vendas Futuras E2E");
            await pagina.fill("#email", EMAIL_FUTURO);
            await pagina.fill("#whatsapp", "11999990010");
            await pagina.fill("#senha", "senha-vendas-futuro-e2e");
            await pagina.check('input[name="aceite"]');
            await pagina.click('button:has-text("Gerar PIX")');
            await pagina.waitForURL(/\/pagamento\//);
            token = new URL(pagina.url()).pathname.split("/")[2];
            const copiaCola = await pagina.locator("#copiaCola").inputValue();
            const match = copiaCola.match(/PIXFAKE(\d+)/);
            if (!match) {
              throw new Error("não consegui extrair o id do pagamento fake do copia-e-cola");
            }
            idPagamentoFake = match[1];
            await ctx.close();
          } finally {
            appFuturo.processo.kill();
            await new Promise((r) => setTimeout(r, 300));
          }

          // reabre o MESMO banco, agora com VENDAS_ATE no passado
          const appPassado = await iniciarApp(fakePort, dbVendas, {
            VENDAS_ATE: "2020-01-01T00:00:00-03:00",
            ADMIN_USER: ADMIN_USER_V,
            ADMIN_PASS: ADMIN_PASS_V,
          });
          try {
            const respGet = await fetch(`${appPassado.baseUrl}/comprar`);
            if (respGet.status !== 410) {
              throw new Error(`GET /comprar com VENDAS_ATE no passado respondeu ${respGet.status}, esperava 410`);
            }
            const htmlEncerradas = await respGet.text();
            if (!/href="\/entrar"/.test(htmlEncerradas)) {
              throw new Error("tela de vendas encerradas não tem link para /entrar");
            }

            const corpoNovo = new URLSearchParams({
              nome: "Aluno Bloqueado E2E",
              email: EMAIL_BLOQUEADO,
              whatsapp: "11999990011",
              senha: "senha-bloqueada-e2e",
              aceite: "on",
            });
            const respPost = await fetch(`${appPassado.baseUrl}/comprar`, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: appPassado.baseUrl,
              },
              body: corpoNovo.toString(),
            });
            if (respPost.status !== 410) {
              throw new Error(`POST /comprar com VENDAS_ATE no passado respondeu ${respPost.status}, esperava 410`);
            }

            const ctxAdmin = await browser.newContext({
              httpCredentials: { username: ADMIN_USER_V, password: ADMIN_PASS_V },
            });
            const paginaAdmin = await ctxAdmin.newPage();
            await paginaAdmin.goto(`${appPassado.baseUrl}/admin`);
            const corpoAdmin = await paginaAdmin.content();
            await ctxAdmin.close();
            if (corpoAdmin.includes(EMAIL_BLOQUEADO)) {
              throw new Error("POST /comprar depois do encerramento gravou um usuário no banco");
            }

            const respNovo = await fetch(`${appPassado.baseUrl}/pagamento/${token}/novo`, {
              method: "POST",
              headers: { Origin: appPassado.baseUrl },
            });
            if (respNovo.status !== 410) {
              throw new Error(
                `POST /pagamento/:token/novo com VENDAS_ATE no passado respondeu ${respNovo.status}, esperava 410`
              );
            }

            // aprova no mp-fake o pedido criado ANTES do encerramento
            const respAprovar = await fetch(`http://127.0.0.1:${fakePort}/__set/${idPagamentoFake}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "approved" }),
            });
            if (!respAprovar.ok) {
              throw new Error(`mp-fake não aceitou a aprovação do pedido antigo (status ${respAprovar.status})`);
            }

            // /api/pedido e /pagamento/:token continuam funcionando após o encerramento
            let statusFinal;
            for (let i = 0; i < 20; i++) {
              const respApi = await fetch(`${appPassado.baseUrl}/api/pedido/${token}`);
              const dados = await respApi.json();
              statusFinal = dados.status;
              if (statusFinal === "pago") break;
              await new Promise((r) => setTimeout(r, 500));
            }
            if (statusFinal !== "pago") {
              throw new Error(`pedido criado antes do encerramento não virou "pago" (ficou "${statusFinal}")`);
            }

            const respPagamento = await fetch(`${appPassado.baseUrl}/pagamento/${token}`);
            if (respPagamento.status !== 200) {
              throw new Error(`/pagamento/${token} respondeu ${respPagamento.status} depois do encerramento`);
            }
          } finally {
            appPassado.processo.kill();
            await new Promise((r) => setTimeout(r, 300));
          }
        } finally {
          try {
            fs.rmSync(dirVendas, { recursive: true, force: true });
          } catch {
            // best effort (Windows pode segurar o arquivo por um instante)
          }
        }
      }
    );
  } finally {
    if (browser) await browser.close();
    appProcess.kill();
    await new Promise((resolve) => mpFake.server.close(resolve));
    try {
      fs.rmSync(dirTemp, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

main()
  .then(() => {
    console.log("");
    console.log(`${passos.filter((p) => p.ok).length}/${passos.length} passos OK`);
    process.exit(falhou ? 1 : 0);
  })
  .catch((erro) => {
    console.error("Falha ao rodar o e2e:", erro);
    process.exit(1);
  });
