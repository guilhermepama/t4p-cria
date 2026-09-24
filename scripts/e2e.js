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
const ALUNO_PROGRESSO = {
  nome: "Aluno Progresso E2E",
  email: `aluno.progresso.${SUFIXO}@exemplo.com`,
  whatsapp: "11999990004",
  senha: "senha-progresso-e2e-1234",
  valor: "49,90",
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

// /entrar tem rate-limit de 10 req/min por IP (proteção de segurança que esta
// tarefa não deve tocar). Os testes de tema (09) já usam boa parte desse
// orçamento com vários logins reais; os testes novos de progresso (10) fazem
// mais alguns, então tentam de novo com espera se caírem no 429 em vez de
// simplesmente falhar.
async function entrarComRetentativa(pagina, credenciais, baseUrl) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 15000));
    await pagina.goto(`${baseUrl}/entrar`);
    await pagina.fill("#email", credenciais.email);
    await pagina.fill("#senha", credenciais.senha);
    const respPromise = pagina.waitForResponse(
      (r) => r.url() === `${baseUrl}/entrar` && r.request().method() === "POST"
    );
    await pagina.click('button:has-text("Entrar")');
    const resp = await respPromise;
    if (resp.status() === 429) continue;
    await pagina.waitForURL(`${baseUrl}/aluno`);
    return;
  }
  throw new Error(`login de ${credenciais.email} bloqueado por rate limit (429) mesmo após novas tentativas`);
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

// ---------- tarefa 09: tema das aulas (visual da landing) ----------
// As 3 aulas ganharam um tema escuro sobreposto (mesmo visual da landing),
// sem tocar na lógica (<script>). As funções abaixo percorrem cada aula até
// o final (como as de cima), mas também conferem, a cada passo, que 360px
// não gera scroll horizontal nem quebra a linha "Passo X de Y", e tiram
// print da abertura + 2 passos quando pedido.

const EVIDENCIAS_AULAS_DIR = path.join(RAIZ, "docs", "claude-bridge", "evidencias", "tarefa-09-aulas");
const EVIDENCIAS_PROGRESSO_DIR = path.join(RAIZ, "docs", "claude-bridge", "evidencias", "tarefa-10-progresso");

function contarLinhas(pagina, seletor) {
  return pagina.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || !el.textContent || !el.textContent.trim()) return 1;
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length;
  }, seletor);
}

async function conferirPasso(pagina, contexto, largura) {
  if (largura !== 360) return;
  const semScrollHorizontal = await pagina.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  if (!semScrollHorizontal) {
    throw new Error(`scroll horizontal em 360px (${contexto}): documentElement.scrollWidth > clientWidth`);
  }
  const linhasPasso = await contarLinhas(pagina, "#passo");
  if (linhasPasso > 1) {
    throw new Error(`"Passo X de Y" quebrou linha em 360px (${contexto})`);
  }
}

// Abre uma aula já logado como o aluno manual, na viewport pedida, e
// devolve a página com os erros de console (inclui violação de CSP, que o
// Chromium também loga como erro no console) coletados ao vivo.
async function abrirAulaLogado(browser, baseUrl, viewport, arquivo) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  const pagina = await ctx.newPage();

  const errosConsole = [];
  pagina.on("console", (msg) => {
    if (msg.type() === "error") errosConsole.push(msg.text());
  });
  pagina.on("pageerror", (erro) => errosConsole.push(String((erro && erro.message) || erro)));

  await pagina.goto(`${baseUrl}/entrar`);
  await pagina.fill("#email", ALUNO_MANUAL.email);
  await pagina.fill("#senha", ALUNO_MANUAL.senha);
  await pagina.click('button:has-text("Entrar")');
  await pagina.waitForURL(`${baseUrl}/aluno`);

  await pagina.goto(`${baseUrl}/aluno/conteudo/${arquivo}`);
  await pagina.evaluate(() => document.fonts.ready);

  return { ctx, pagina, errosConsole };
}

async function conferirTemaEFontes(pagina, contexto) {
  if ((await pagina.locator("#tema-t4p").count()) === 0) {
    throw new Error(`${contexto}: não achei <style id="tema-t4p">`);
  }
  if ((await pagina.locator("header.topo").count()) === 0) {
    throw new Error(`${contexto}: não achei <header class="topo">`);
  }
  const hrefTopo = await pagina.locator(".topo-link").getAttribute("href");
  if (hrefTopo !== "/aluno") {
    throw new Error(`${contexto}: link "Área do aluno" aponta para "${hrefTopo}", esperava "/aluno"`);
  }
  // document.fonts.check('16px "<família>"') (peso/estilo padrão: 400 normal) dá falso
  // negativo aqui: o tema só usa Instrument Serif em itálico e nunca pede Inter Tight no
  // peso 400 (só 500–800), então esse par nunca é carregado mesmo com as fontes OK — a
  // rede confirma 200 nos .woff2 e as variantes realmente usadas ficam com status
  // "loaded". Por isso a checagem aqui é "existe alguma variante carregada da família",
  // que é o que a validação da tarefa quer dizer com "fontes do Google carregam".
  const fontes = await pagina.evaluate(() => {
    const carregouAlgumaVariante = (familia) =>
      Array.from(document.fonts).some((f) => f.family.replace(/"/g, "") === familia && f.status === "loaded");
    return {
      serif: carregouAlgumaVariante("Instrument Serif"),
      display: carregouAlgumaVariante("Inter Tight"),
    };
  });
  if (!fontes.serif || !fontes.display) {
    throw new Error(`${contexto}: fontes não carregaram (${JSON.stringify(fontes)})`);
  }
}

function conferirSemErrosNoConsole(errosConsole, contexto) {
  if (errosConsole.length) {
    throw new Error(`${contexto}: erro(s) no console (inclui possível violação de CSP): ${errosConsole.join(" | ")}`);
  }
}

async function percorrerAula1Tema(pagina, opcoes) {
  const { largura, print, prefixo } = opcoes;
  async function pos(nome, tirarPrint) {
    await conferirPasso(pagina, `${prefixo}/${nome}`, largura);
    if (tirarPrint && print) {
      await pagina.screenshot({ path: path.join(EVIDENCIAS_AULAS_DIR, `${prefixo}-${nome}.png`) });
    }
  }

  await pos("hero", true);
  await pagina.click("#comecar");
  await continuarQuandoLiberado(pagina);
  await continuarQuandoLiberado(pagina);
  await continuarQuandoLiberado(pagina);

  await pagina.click("#ver-generica");
  await continuarQuandoLiberado(pagina);

  await pagina.locator('[data-r="1"]').first().click();
  await pagina.locator("#rodada-2:not(.oculto)").waitFor();
  await pagina.locator('[data-r="2"]').first().click();
  await continuarQuandoLiberado(pagina);

  const itensEstagiario = pagina.locator("#lista-estagiario .item");
  const totalItens = await itensEstagiario.count();
  for (let i = 0; i < totalItens; i++) await itensEstagiario.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-cafe

  await pos("cafe", true);
  const letrasCafe = pagina.locator(".letras .letra");
  const totalLetras = await letrasCafe.count();
  for (let i = 0; i < totalLetras; i++) await letrasCafe.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-pratica

  const ingredientes = pagina.locator("#ingredientes .btn-linha");
  const totalIngredientes = await ingredientes.count();
  for (let i = 0; i < totalIngredientes; i++) await ingredientes.nth(i).click();
  await pagina.locator("#ver-cafe:not([disabled])").waitFor();
  await pagina.click("#ver-cafe");
  await continuarQuandoLiberado(pagina); // -> s-exercicio

  await pos("exercicio", true);
  await pagina.fill("#f-negocio", "doceria");
  await pagina.click("#copiar");
  await pagina.locator("#copiar", { hasText: "Pedido copiado" }).waitFor({ timeout: 3000 });

  await continuarQuandoLiberado(pagina); // -> quiz

  for (const letraCerta of ["C", "F", "A"]) {
    await pagina.locator(`#quiz-letras .letra[data-q="${letraCerta}"]`).click();
    const proxima = pagina.locator("#quiz-proxima");
    if (!(await proxima.evaluate((el) => el.classList.contains("oculto")))) {
      await proxima.click();
    }
  }
  await continuarQuandoLiberado(pagina); // -> s-final
  await pos("final", false);
}

async function percorrerAula2Tema(pagina, opcoes) {
  const { largura, print, prefixo } = opcoes;
  async function pos(nome, tirarPrint) {
    await conferirPasso(pagina, `${prefixo}/${nome}`, largura);
    if (tirarPrint && print) {
      await pagina.screenshot({ path: path.join(EVIDENCIAS_AULAS_DIR, `${prefixo}-${nome}.png`) });
    }
  }

  await pos("hero", true);
  await pagina.click("#comecar");
  await continuarQuandoLiberado(pagina); // i1 -> i2 (s-segunda, trava)

  await pagina.click("#devolver");
  await continuarQuandoLiberado(pagina); // -> s-caso1

  await pos("caso1", true);
  await pagina.locator('.diag-letras[data-caso="1"] .letra[data-l="C"]').click();
  await continuarQuandoLiberado(pagina); // -> s-caso2

  await pagina.locator('.diag-letras[data-caso="2"] .letra[data-l="A"]').click();
  await continuarQuandoLiberado(pagina); // -> s-caso3

  await pagina.locator('.diag-letras[data-caso="3"] .letra[data-l="F"]').click();
  await continuarQuandoLiberado(pagina); // -> s-caso4

  await pagina.locator('.diag-letras[data-caso="4"] .letra[data-l="E"]').click();
  await continuarQuandoLiberado(pagina); // -> s-limites

  const itensLimites = pagina.locator("#lista-limites .item");
  const totalLimites = await itensLimites.count();
  for (let i = 0; i < totalLimites; i++) await itensLimites.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-comandos

  await pos("comandos", true);
  await continuarQuandoLiberado(pagina); // -> s-final
  await pos("final", false);
}

async function percorrerAula3Tema(pagina, opcoes) {
  const { largura, print, prefixo } = opcoes;
  async function pos(nome, tirarPrint) {
    await conferirPasso(pagina, `${prefixo}/${nome}`, largura);
    if (tirarPrint && print) {
      await pagina.screenshot({ path: path.join(EVIDENCIAS_AULAS_DIR, `${prefixo}-${nome}.png`) });
    }
  }

  await pos("hero", true);
  await pagina.click("#comecar"); // -> s-problema

  const itensSintomas = pagina.locator("#lista-sintomas .item");
  const totalSintomas = await itensSintomas.count();
  for (let i = 0; i < totalSintomas; i++) await itensSintomas.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-mesa

  const itensMesas = pagina.locator("#lista-mesas .mesa");
  const totalMesas = await itensMesas.count();
  for (let i = 0; i < totalMesas; i++) await itensMesas.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-demo

  await pos("demo", true);
  await pagina.click("#ver-sem");
  await pagina.locator("#ver-com:not(.oculto)").waitFor();
  await pagina.click("#ver-com");
  await continuarQuandoLiberado(pagina); // -> s-manual

  const itensManual = pagina.locator("#lista-manual .item");
  const totalManual = await itensManual.count();
  for (let i = 0; i < totalManual; i++) await itensManual.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-obra

  await pos("obra", true);
  await pagina.click("#depois");
  await continuarQuandoLiberado(pagina); // -> s-limites

  const itensVerdades = pagina.locator("#lista-verdades .item");
  const totalVerdades = await itensVerdades.count();
  for (let i = 0; i < totalVerdades; i++) await itensVerdades.nth(i).click();
  await continuarQuandoLiberado(pagina); // -> s-final
  await pos("final", false);
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

    await passo("/admin cadastra o aluno usado nos testes de progresso (tarefa 10)", async () => {
      await paginaAdmin.goto(`${baseUrl}/admin`);
      await paginaAdmin.fill("#nome", ALUNO_PROGRESSO.nome);
      await paginaAdmin.fill("#email", ALUNO_PROGRESSO.email);
      await paginaAdmin.fill("#whatsapp", ALUNO_PROGRESSO.whatsapp);
      await paginaAdmin.fill("#senha", ALUNO_PROGRESSO.senha);
      await paginaAdmin.fill("#valor", ALUNO_PROGRESSO.valor);
      await paginaAdmin.click('button:has-text("Cadastrar aluno")');
      await paginaAdmin.waitForURL(`${baseUrl}/admin`);
      const corpo = await paginaAdmin.content();
      if (!corpo.includes(ALUNO_PROGRESSO.email)) {
        throw new Error("aluno de progresso não aparece na tabela do /admin");
      }
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

    // ---------- tarefa 09: tema das aulas (visual da landing) ----------
    fs.mkdirSync(EVIDENCIAS_AULAS_DIR, { recursive: true });

    // ---------- tarefa 10: progresso do aluno (aulas + downloads) ----------
    // (infra de print declarada aqui porque a screenshot do estado "concluída"
    // é tirada logo abaixo, ao final da cadeia 1440 que já percorre as 3 aulas.)
    fs.mkdirSync(EVIDENCIAS_PROGRESSO_DIR, { recursive: true });

    const VIEWPORTS_PROGRESSO = [
      { nome: "1280", width: 1280, height: 900 },
      { nome: "390", width: 390, height: 844 },
    ];

    async function printarAluno(pagina, nomeEstado) {
      for (const viewport of VIEWPORTS_PROGRESSO) {
        await pagina.setViewportSize({ width: viewport.width, height: viewport.height });
        await pagina.screenshot({
          path: path.join(EVIDENCIAS_PROGRESSO_DIR, `aluno-${nomeEstado}-${viewport.nome}.png`),
          fullPage: true,
        });
      }
    }

    await passo(
      "aulas (1440px): tema + fontes OK, percorre Aula 1→2→3 até o final clicando nos links reais, sem erro no console",
      async () => {
        const viewport = { nome: "1440", width: 1440, height: 900 };
        const { ctx, pagina, errosConsole } = await abrirAulaLogado(
          browser,
          baseUrl,
          viewport,
          "Aula1_O_Pedido_que_Funciona.html"
        );
        try {
          await conferirTemaEFontes(pagina, "Aula1 (1440)");
          await percorrerAula1Tema(pagina, { largura: viewport.width, print: true, prefixo: "aula1-1440" });

          await pagina.getByRole("link", { name: "Ir para a Aula 2" }).click();
          await pagina.waitForURL(/Aula2_Conserte_a_Resposta\.html/);
          await pagina.evaluate(() => document.fonts.ready);
          await conferirTemaEFontes(pagina, "Aula2 (1440)");
          await percorrerAula2Tema(pagina, { largura: viewport.width, print: true, prefixo: "aula2-1440" });

          await pagina.getByRole("link", { name: "Ir para a Aula 3" }).click();
          await pagina.waitForURL(/Aula3_Monte_sua_Equipe\.html/);
          await pagina.evaluate(() => document.fonts.ready);
          await conferirTemaEFontes(pagina, "Aula3 (1440)");
          await percorrerAula3Tema(pagina, { largura: viewport.width, print: true, prefixo: "aula3-1440" });

          await pagina.getByRole("link", { name: "Voltar à área do aluno" }).click();
          await pagina.waitForURL(`${baseUrl}/aluno`);

          // tarefa 10: as 3 aulas foram percorridas até o final acima (percorrerAulaXTema),
          // então /aluno deve mostrar "✓ Concluída" nas 3 (progresso no servidor).
          for (const arquivo of [
            "Aula1_O_Pedido_que_Funciona.html",
            "Aula2_Conserte_a_Resposta.html",
            "Aula3_Monte_sua_Equipe.html",
          ]) {
            const cartao = pagina.locator(`.card[data-aula="${arquivo}"]`);
            const textoProgresso = await cartao.locator(".texto-progresso").textContent();
            if (!textoProgresso || !textoProgresso.includes("Concluída")) {
              throw new Error(`/aluno não mostra "✓ Concluída" para ${arquivo} (veio "${textoProgresso}")`);
            }
            const rotuloBotao = await cartao.locator(".btn").textContent();
            if (rotuloBotao !== "Rever aula") {
              throw new Error(`botão de ${arquivo} deveria ser "Rever aula", veio "${rotuloBotao}"`);
            }
          }

          await printarAluno(pagina, "concluida");

          conferirSemErrosNoConsole(errosConsole, "cadeia 1440 (Aula1 → Aula2 → Aula3 → /aluno)");
        } finally {
          await ctx.close();
        }
      }
    );

    const AULAS_TEMA = [
      { arquivo: "Aula1_O_Pedido_que_Funciona.html", percorrer: percorrerAula1Tema, prefixo: "aula1" },
      { arquivo: "Aula2_Conserte_a_Resposta.html", percorrer: percorrerAula2Tema, prefixo: "aula2" },
      { arquivo: "Aula3_Monte_sua_Equipe.html", percorrer: percorrerAula3Tema, prefixo: "aula3" },
    ];

    for (const aula of AULAS_TEMA) {
      await passo(
        `${aula.prefixo}: tema + fontes OK em 390px e 360px, percorrida até o final, sem scroll horizontal nem "Passo X de Y" quebrado em 360px, sem erro no console`,
        async () => {
          const viewports = [
            { nome: "390", width: 390, height: 844, print: true },
            { nome: "360", width: 360, height: 780, print: false },
          ];
          for (const viewport of viewports) {
            const { ctx, pagina, errosConsole } = await abrirAulaLogado(browser, baseUrl, viewport, aula.arquivo);
            try {
              await conferirTemaEFontes(pagina, `${aula.prefixo} (${viewport.nome})`);
              await aula.percorrer(pagina, {
                largura: viewport.width,
                print: viewport.print,
                prefixo: `${aula.prefixo}-${viewport.nome}`,
              });
              conferirSemErrosNoConsole(errosConsole, `${aula.prefixo} (${viewport.nome})`);
            } finally {
              await ctx.close();
            }
          }
        }
      );
    }

    // ---------- tarefa 10: progresso do aluno (continuação — aulas/downloads do próprio aluno) ----------

    const ctxProgresso = await browser.newContext({ reducedMotion: "reduce" });
    const paginaProgresso = await ctxProgresso.newPage();

    await passo("/entrar com o aluno de progresso → /aluno mostra as 3 aulas 'Não iniciada'", async () => {
      await entrarComRetentativa(paginaProgresso, ALUNO_PROGRESSO, baseUrl);

      const textoAula1 = await paginaProgresso
        .locator('.card[data-aula="Aula1_O_Pedido_que_Funciona.html"] .texto-progresso')
        .textContent();
      if (!textoAula1 || !textoAula1.includes("Não iniciada")) {
        throw new Error(`Aula 1 deveria mostrar "Não iniciada", veio "${textoAula1}"`);
      }

      await printarAluno(paginaProgresso, "nao-iniciada-e-nao-baixado");
    });

    let totalAula1;

    await passo(
      'Aula 1: avança até o passo 3 → /aluno mostra "Passo 3 de N"; volta para o passo 2 → continua mostrando 3',
      async () => {
        const [aula1] = await Promise.all([
          ctxProgresso.waitForEvent("page"),
          paginaProgresso.getByRole("link", { name: "Abrir aula" }).first().click(),
        ]);
        await aula1.waitForLoadState();

        totalAula1 = await aula1.evaluate(() => document.querySelectorAll(".step").length - 1);

        await Promise.all([
          aula1.waitForResponse((r) => r.url().endsWith("/aluno/progresso") && r.request().method() === "POST"),
          aula1.click("#comecar"), // ir(1)
        ]);
        await Promise.all([
          aula1.waitForResponse((r) => r.url().endsWith("/aluno/progresso") && r.request().method() === "POST"),
          continuarQuandoLiberado(aula1), // ir(2)
        ]);
        await Promise.all([
          aula1.waitForResponse((r) => r.url().endsWith("/aluno/progresso") && r.request().method() === "POST"),
          continuarQuandoLiberado(aula1), // ir(3)
        ]);

        // O Chromium headless não "esconde" mesmo as abas em segundo plano
        // (document.visibilityState fica sempre "visible"), então bringToFront()
        // sozinho não dispara o evento aqui como faria num navegador de verdade.
        // Disparamos o mesmo evento que o script de /aluno escuta, para validar
        // a lógica de atualização (fetch + troca do cartão) sem depender de
        // como o Chromium headless simula foco de aba.
        await paginaProgresso.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await paginaProgresso.waitForFunction(
          () =>
            document.querySelector('.card[data-aula="Aula1_O_Pedido_que_Funciona.html"] .texto-progresso')
              .textContent.indexOf("Passo") === 0
        );
        const textoPasso3 = await paginaProgresso
          .locator('.card[data-aula="Aula1_O_Pedido_que_Funciona.html"] .texto-progresso')
          .textContent();
        if (textoPasso3 !== `Passo 3 de ${totalAula1}`) {
          throw new Error(`esperava "Passo 3 de ${totalAula1}" em /aluno, veio "${textoPasso3}"`);
        }

        await Promise.all([
          aula1.waitForResponse((r) => r.url().endsWith("/aluno/progresso") && r.request().method() === "POST"),
          aula1.click("#voltar"), // ir(2) — não pode regredir o que já foi salvo (passo 3)
        ]);

        // O reload não depende de visibilitychange: é o servidor renderizando
        // o estado atual direto no HTML, então confirma a persistência de verdade.
        await paginaProgresso.reload();
        const textoAposVoltar = await paginaProgresso
          .locator('.card[data-aula="Aula1_O_Pedido_que_Funciona.html"] .texto-progresso')
          .textContent();
        if (textoAposVoltar !== `Passo 3 de ${totalAula1}`) {
          throw new Error(
            `depois de "Voltar" na aula, /aluno deveria continuar em "Passo 3 de ${totalAula1}", veio "${textoAposVoltar}"`
          );
        }

        await aula1.close();
      }
    );

    await passo(
      "Baixar 'assistente_vendas.txt': '✓ Baixado' aparece na hora, persiste após reload, e outro aluno não vê o check",
      async () => {
        const linha = paginaProgresso.locator('.download[data-arquivo="assistente_vendas.txt"]');
        const checkAntes = await linha.locator(".check-baixado").isVisible();
        if (checkAntes) throw new Error('"✓ Baixado" já aparecia antes do download');

        await Promise.all([
          paginaProgresso.waitForEvent("download"),
          linha.locator(".link-baixar").click(),
        ]);

        if (!(await linha.locator(".check-baixado").isVisible())) {
          throw new Error('"✓ Baixado" não apareceu na hora do clique (atualização otimista)');
        }
        if ((await linha.locator(".link-baixar").textContent()) !== "Baixar de novo") {
          throw new Error('link não virou "Baixar de novo" depois do clique');
        }

        await paginaProgresso.reload();
        const linhaDepois = paginaProgresso.locator('.download[data-arquivo="assistente_vendas.txt"]');
        if (!(await linhaDepois.locator(".check-baixado").isVisible())) {
          throw new Error('"✓ Baixado" não persistiu depois do reload');
        }

        // estado "em andamento" (Passo 3 de N, da etapa anterior) + "✓ Baixado"
        // já persistido no reload acima.
        await printarAluno(paginaProgresso, "em-andamento-e-baixado");

        const ctxOutroAluno = await browser.newContext();
        const paginaOutroAluno = await ctxOutroAluno.newPage();
        await entrarComRetentativa(paginaOutroAluno, ALUNO_MANUAL, baseUrl);
        const linhaOutroAluno = paginaOutroAluno.locator('.download[data-arquivo="assistente_vendas.txt"]');
        if (await linhaOutroAluno.locator(".check-baixado").isVisible()) {
          throw new Error("outro aluno também aparece com \"✓ Baixado\" (progresso vazando entre contas)");
        }
        await ctxOutroAluno.close();
      }
    );

    await passo(
      "POST /aluno/progresso: sem sessão → redireciona para /entrar; sem Origin válido → 403; corpo inválido → 400",
      async () => {
        const paginaAnonima = await browser.newPage();
        const respSemSessao = await paginaAnonima.request.post(`${baseUrl}/aluno/progresso`, {
          headers: { "Content-Type": "application/json", Origin: baseUrl },
          data: { aula: "Aula1_O_Pedido_que_Funciona.html", passo: 1, total: 10 },
          maxRedirects: 0,
        });
        if (respSemSessao.status() !== 302) {
          throw new Error(`sem sessão: esperava 302 (redirect para /entrar), veio ${respSemSessao.status()}`);
        }
        const destino = respSemSessao.headers()["location"] || "";
        if (!destino.includes("/entrar")) {
          throw new Error(`sem sessão: redirect não aponta para /entrar (veio "${destino}")`);
        }
        await paginaAnonima.close();

        const respOrigemInvalida = await paginaProgresso.request.post(`${baseUrl}/aluno/progresso`, {
          headers: { "Content-Type": "application/json", Origin: "https://outro-dominio.exemplo" },
          data: { aula: "Aula1_O_Pedido_que_Funciona.html", passo: 1, total: 10 },
          maxRedirects: 0,
        });
        if (respOrigemInvalida.status() !== 403) {
          throw new Error(`Origin inválida: esperava 403, veio ${respOrigemInvalida.status()}`);
        }

        const corposInvalidos = [
          { aula: "Aula4_Inexistente.html", passo: 1, total: 10 },
          { aula: "Aula1_O_Pedido_que_Funciona.html", passo: 11, total: 10 },
          { aula: "Aula1_O_Pedido_que_Funciona.html", passo: 5, total: 31 },
          { aula: "Aula1_O_Pedido_que_Funciona.html", passo: -1, total: 10 },
        ];
        for (const corpo of corposInvalidos) {
          const resp = await paginaProgresso.request.post(`${baseUrl}/aluno/progresso`, {
            headers: { "Content-Type": "application/json", Origin: baseUrl },
            data: corpo,
          });
          if (resp.status() !== 400) {
            throw new Error(`corpo ${JSON.stringify(corpo)} deveria responder 400, veio ${resp.status()}`);
          }
        }
      }
    );

    await passo(
      "Aula com POST /aluno/progresso falhando (servidor fora do ar): navegação segue normal, sem erro na página",
      async () => {
        const ctx = await browser.newContext({ reducedMotion: "reduce" });
        const pagina = await ctx.newPage();
        const errosPagina = [];
        pagina.on("pageerror", (erro) => errosPagina.push(String((erro && erro.message) || erro)));
        await ctx.route("**/aluno/progresso", (route) => route.abort());

        await entrarComRetentativa(pagina, ALUNO_PROGRESSO, baseUrl);

        const [aula1] = await Promise.all([
          ctx.waitForEvent("page"),
          pagina.getByRole("link", { name: "Abrir aula" }).first().click(),
        ]);
        await aula1.waitForLoadState();
        await aula1.click("#comecar");
        await continuarQuandoLiberado(aula1);

        const textoPasso = await aula1.locator("#passo").textContent();
        if (!/^Passo \d+ de \d+$/.test(textoPasso || "")) {
          throw new Error(`a aula parou de responder depois do POST falho (passo="${textoPasso}")`);
        }
        if (errosPagina.length) {
          throw new Error(`erro não tratado na página da aula com POST falho: ${errosPagina.join(" | ")}`);
        }

        await ctx.close();
      }
    );

    await ctxProgresso.close();

    await passo("/admin mostra o bloco 'Uso do conteúdo' com números coerentes com os testes", async () => {
      const ctx = await browser.newContext({
        httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
      });
      const pagina = await ctx.newPage();
      await pagina.goto(`${baseUrl}/admin`);
      const corpo = await pagina.content();
      if (!corpo.includes("Uso do conteúdo")) {
        throw new Error("/admin não tem o bloco \"Uso do conteúdo\"");
      }

      const linhaAula1 = pagina.locator("tr", { hasText: "Aula 1 — O pedido que funciona" });
      const celulasAula1 = await linhaAula1.locator("td").allTextContents();
      if (Number(celulasAula1[1]) < 2) {
        throw new Error(`Aula 1: esperava pelo menos 2 alunos com progresso, veio "${celulasAula1[1]}"`);
      }
      if (Number(celulasAula1[2]) < 1) {
        throw new Error(`Aula 1: esperava pelo menos 1 aluno concluído, veio "${celulasAula1[2]}"`);
      }

      const linhaVendas = pagina.locator("tr", { hasText: "Assistente de vendas (.txt)" });
      const celulasVendas = await linhaVendas.locator("td").allTextContents();
      if (Number(celulasVendas[1]) < 1) {
        throw new Error(`assistente de vendas: esperava pelo menos 1 download, veio "${celulasVendas[1]}"`);
      }

      await ctx.close();
    });

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

    // ---------- tarefa 13: avaliação do curso ----------
    const EVIDENCIAS_AVALIACAO_DIR = path.join(RAIZ, "docs", "claude-bridge", "evidencias", "tarefa-13-avaliacao");
    fs.mkdirSync(EVIDENCIAS_AVALIACAO_DIR, { recursive: true });
    const AULA1_ARQ = "Aula1_O_Pedido_que_Funciona.html";
    const AULA3_ARQ = "Aula3_Monte_sua_Equipe.html";
    const AUTH_ADMIN = "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64");
    const TEXTO_OBRIGADO = "Obrigado! Sua avaliação foi registrada.";
    const TEXTO_FALHA = "Não deu para enviar agora. Tente de novo em instantes.";
    const ALUNO_AVAL = {
      nome: "Aluno Avaliacao E2E",
      email: `aluno.avaliacao.${SUFIXO}@exemplo.com`,
      whatsapp: "11999990005",
      senha: "senha-avaliacao-e2e-1234",
      valor: "49,90",
    };
    const ALUNO_AVAL2 = {
      nome: "Aluno Avaliacao Dois E2E",
      email: `aluno.avaliacao2.${SUFIXO}@exemplo.com`,
      whatsapp: "11999990006",
      senha: "senha-avaliacao2-e2e-1234",
      valor: "49,90",
    };

    const ctxAdminAv = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const paginaAdminAv = await ctxAdminAv.newPage();

    async function abrirAlunoLogado(aluno, viewport) {
      const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const pagina = await ctx.newPage();
      const errosConsole = [];
      pagina.on("console", (msg) => {
        if (msg.type() === "error") errosConsole.push(msg.text());
      });
      pagina.on("pageerror", (erro) => errosConsole.push(String((erro && erro.message) || erro)));
      await entrarComRetentativa(pagina, aluno, baseUrl);
      return { ctx, pagina, errosConsole };
    }

    async function esperarConcluida(pagina, arquivo) {
      for (let i = 0; i < 40; i++) {
        const concluida = await pagina.evaluate(async (arq) => {
          const r = await fetch("/aluno/progresso.json", { credentials: "same-origin" });
          const d = await r.json();
          return Boolean(d.aulas[arq] && d.aulas[arq].concluido);
        }, arquivo);
        if (concluida) return;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(`${arquivo} não ficou concluída no servidor`);
    }

    async function printarAvaliacao(pagina, seletor, nome, opcoes = {}) {
      for (const [rotulo, largura, altura] of [
        ["1280", 1280, 900],
        ["390", 390, 844],
      ]) {
        await pagina.setViewportSize({ width: largura, height: altura });
        if (seletor) await pagina.locator(seletor).first().scrollIntoViewIfNeeded();
        await pagina.screenshot({
          path: path.join(EVIDENCIAS_AVALIACAO_DIR, `${nome}-${rotulo}.png`),
          fullPage: Boolean(opcoes.fullPage),
        });
      }
      await pagina.setViewportSize({ width: 1280, height: 900 });
    }

    async function cadastrarAlunoManual(aluno) {
      await paginaAdminAv.goto(`${baseUrl}/admin`);
      await paginaAdminAv.fill("#nome", aluno.nome);
      await paginaAdminAv.fill("#email", aluno.email);
      await paginaAdminAv.fill("#whatsapp", aluno.whatsapp);
      await paginaAdminAv.fill("#senha", aluno.senha);
      await paginaAdminAv.fill("#valor", aluno.valor);
      await paginaAdminAv.click('button:has-text("Cadastrar aluno")');
      await paginaAdminAv.waitForURL(`${baseUrl}/admin`);
    }

    async function preencherEEnviar(bloco, { nota, comentario, divulgar }) {
      await bloco.locator(`input[name="nota"][value="${nota}"]`).check();
      if (comentario) await bloco.locator("textarea").fill(comentario);
      if (divulgar) await bloco.locator('input[name="podeDivulgar"]').check();
      await bloco.locator(".av-enviar").click();
    }

    function postAvaliacao(pagina, corpo) {
      return pagina.evaluate(async (c) => {
        const r = await fetch("/aluno/avaliacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
          credentials: "same-origin",
        });
        return r.status;
      }, corpo);
    }

    async function adminHtml() {
      return (await fetch(`${baseUrl}/admin`, { headers: { Authorization: AUTH_ADMIN } })).text();
    }

    await passo("avaliação: cadastra os alunos de teste (tarefa 13)", async () => {
      await cadastrarAlunoManual(ALUNO_AVAL);
      await cadastrarAlunoManual(ALUNO_AVAL2);
    });

    // ---- ALUNO_AVAL: Aula 1 → avaliação intermediária dentro da aula ----
    const alunoAval = await abrirAlunoLogado(ALUNO_AVAL, { width: 1280, height: 900 });
    let paginaAula1Aval;

    await passo(
      "avaliação: fim da Aula 1 mostra o bloco; 'Enviar' desabilitado sem nota; nota 4 + comentário + autorização → 'Obrigado!'",
      async () => {
        paginaAula1Aval = await alunoAval.ctx.newPage();
        paginaAula1Aval.on("pageerror", (erro) => alunoAval.errosConsole.push(String(erro.message || erro)));
        await paginaAula1Aval.goto(`${baseUrl}/aluno/conteudo/${AULA1_ARQ}`);
        await paginaAula1Aval.evaluate(() => document.fonts.ready);
        await percorrerAula1Tema(paginaAula1Aval, { largura: 1280, print: false, prefixo: "aval-aula1" });

        const bloco = paginaAula1Aval.locator('.avaliacao[data-etapa="intermediaria"]');
        await bloco.waitFor({ state: "visible" });
        const titulo = await bloco.locator("h3").textContent();
        if (titulo !== "O que você está achando do curso até aqui?") throw new Error(`título inesperado: ${titulo}`);
        if (!(await bloco.locator(".av-enviar").isDisabled())) throw new Error("'Enviar' deveria estar desabilitado sem nota");
        if ((await bloco.locator(".legenda").count()) !== 0) throw new Error("a legenda deveria ter sido removida");
        await printarAvaliacao(paginaAula1Aval, '.avaliacao[data-etapa="intermediaria"]', "aula1-antes");

        if ((await bloco.getByRole("radio", { name: /estrelas?$/ }).count()) !== 5) throw new Error("as 5 estrelas deveriam ser radios acessíveis");
        await bloco.getByRole("radio", { name: "4 estrelas" }).check({ force: true });
        if (await bloco.locator(".av-enviar").isDisabled()) throw new Error("'Enviar' deveria habilitar após escolher nota");
        if ((await bloco.locator(".nota.cheia").count()) !== 4) throw new Error("deveria haver 4 estrelas cheias");
        if ((await bloco.locator(".av-valor").textContent()) !== "4 de 5") throw new Error("texto '4 de 5' ausente");
        await bloco.getByRole("radio", { name: "2 estrelas" }).check({ force: true });
        if ((await bloco.locator(".nota.cheia").count()) !== 2) throw new Error("deveria haver 2 estrelas cheias");
        await bloco.getByRole("radio", { name: "4 estrelas" }).check({ force: true });
        await bloco.locator(".nota").nth(3).click();
        await paginaAula1Aval.mouse.move(5, 5);
        await printarAvaliacao(paginaAula1Aval, '.avaliacao[data-etapa="intermediaria"]', "aula1-4-estrelas");
        await preencherEEnviar(bloco, { nota: 4, comentario: "Ajudou bastante a pedir melhor.", divulgar: true });
        await bloco.locator(".av-ok", { hasText: TEXTO_OBRIGADO }).waitFor({ state: "visible" });
        if (await bloco.locator(".av-form").isVisible()) throw new Error("formulário deveria sumir após o envio");
        await printarAvaliacao(paginaAula1Aval, '.avaliacao[data-etapa="intermediaria"]', "aula1-depois");

        const links = await paginaAula1Aval.getByRole("link", { name: "Ir para a Aula 2" }).count();
        if (links !== 1) throw new Error("link 'Ir para a Aula 2' sumiu");
      }
    );

    await passo("avaliação: /admin mostra a resposta da Aula 1 com '✓ pode divulgar' e a média", async () => {
      const html = await adminHtml();
      if (!html.includes("Ajudou bastante a pedir melhor.")) throw new Error("comentário não aparece no /admin");
      if (!html.includes("✓ pode divulgar")) throw new Error("'✓ pode divulgar' não aparece no /admin");
      if (!/Aula 1 \(intermediária\)<\/td><td>1<\/td><td>4,0<\/td><td>1:0 · 2:0 · 3:0 · 4:1 · 5:0<\/td>/.test(html)) {
        throw new Error("resumo da Aula 1 no /admin não bate (1 resposta, média 4,0, 4:1)");
      }
    });

    await passo("avaliação: reenvio da mesma etapa com nota 5 sobrescreve (continua 1 resposta) e o XSS sai como texto", async () => {
      const status = await postAvaliacao(paginaAula1Aval, {
        etapa: "intermediaria",
        nota: 5,
        comentario: "<img src=x onerror=alert(1)>",
        podeDivulgar: true,
      });
      if (status !== 204) throw new Error(`reenvio respondeu ${status}`);

      const html = await adminHtml();
      if (!/Aula 1 \(intermediária\)<\/td><td>1<\/td><td>5,0<\/td><td>1:0 · 2:0 · 3:0 · 4:0 · 5:1<\/td>/.test(html)) {
        throw new Error("após o reenvio deveria ter 1 resposta, média 5,0");
      }
      if (html.includes("<img src=x")) throw new Error("comentário não foi escapado no HTML do /admin");

      let dialogo = false;
      paginaAdminAv.on("dialog", async (d) => {
        dialogo = true;
        await d.dismiss();
      });
      await paginaAdminAv.goto(`${baseUrl}/admin`);
      await paginaAdminAv.locator("td", { hasText: "<img src=x onerror=alert(1)>" }).first().waitFor();
      if ((await paginaAdminAv.locator('img[src="x"]').count()) !== 0) throw new Error("o <img> foi renderizado no /admin");
      if (dialogo) throw new Error("o comentário executou script no /admin");
    });

    // ---- ALUNO_AVAL: Aula 3 → avaliação final dentro da aula ----
    await passo("avaliação: fim da Aula 3 mostra a avaliação final e grava como 'final'", async () => {
      const pagina = await alunoAval.ctx.newPage();
      pagina.on("pageerror", (erro) => alunoAval.errosConsole.push(String(erro.message || erro)));
      await pagina.goto(`${baseUrl}/aluno/conteudo/${AULA3_ARQ}`);
      await pagina.evaluate(() => document.fonts.ready);
      await percorrerAula3Tema(pagina, { largura: 1280, print: false, prefixo: "aval-aula3" });

      const bloco = pagina.locator('.avaliacao[data-etapa="final"]');
      await bloco.waitFor({ state: "visible" });
      if ((await bloco.locator("h3").textContent()) !== "Que nota você dá para o curso?") throw new Error("título final inesperado");
      const rotulo = await bloco.locator(".av-campo span").textContent();
      if (rotulo !== "O que você já usou ou vai usar no seu negócio? (opcional)") throw new Error(`rótulo final: ${rotulo}`);
      await printarAvaliacao(pagina, '.avaliacao[data-etapa="final"]', "aula3-final");
      await bloco.locator(".nota").nth(3).click();
      await pagina.mouse.move(5, 5);
      await printarAvaliacao(pagina, '.avaliacao[data-etapa="final"]', "aula3-final-4-estrelas");
      await preencherEEnviar(bloco, { nota: 5, comentario: '=HYPERLINK("http://x")', divulgar: false });
      await bloco.locator(".av-ok", { hasText: TEXTO_OBRIGADO }).waitFor({ state: "visible" });
      await printarAvaliacao(pagina, '.avaliacao[data-etapa="final"]', "aula3-final-enviada");

      const html = await adminHtml();
      if (!/Aula 3 \(final\)<\/td><td>1<\/td><td>5,0<\/td>/.test(html)) throw new Error("resumo da etapa final não bate no /admin");
      await pagina.close();
    });

    await passo("avaliação: /aluno de quem respondeu as duas etapas não mostra cartão", async () => {
      await alunoAval.pagina.goto(`${baseUrl}/aluno`);
      const visiveis = await alunoAval.pagina.locator(".avaliacao:visible").count();
      if (visiveis !== 0) throw new Error(`esperava 0 cartões, veio ${visiveis}`);
    });

    await passo("avaliação: /admin — bloco 'Avaliações' (prints)", async () => {
      await paginaAdminAv.goto(`${baseUrl}/admin`);
      await printarAvaliacao(paginaAdminAv, "h2:has-text('Avaliações')", "admin-avaliacoes");
    });

    await passo("avaliação: /admin/avaliacoes.csv exige Basic Auth, tem BOM, colunas certas e neutraliza fórmula", async () => {
      const semAuth = await fetch(`${baseUrl}/admin/avaliacoes.csv`);
      if (semAuth.status !== 401) throw new Error(`sem auth deveria dar 401, deu ${semAuth.status}`);
      const resp = await fetch(`${baseUrl}/admin/avaliacoes.csv`, { headers: { Authorization: AUTH_ADMIN } });
      const bytes = Buffer.from(await resp.arrayBuffer());
      if (!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) throw new Error("CSV sem BOM");
      const linhas = bytes.subarray(3).toString("utf8").split("\r\n");
      if (linhas[0] !== "data;etapa;nota;nome;email;comentario;pode_divulgar") throw new Error(`cabeçalho: ${linhas[0]}`);
      const linhaFinal = linhas.find((l) => l.includes('"final"'));
      if (!linhaFinal || !linhaFinal.includes(`"'=HYPERLINK(""http://x"")"`)) {
        throw new Error(`comentário com "=" não foi neutralizado: ${linhaFinal}`);
      }
      if (!linhaFinal.endsWith('"não"')) throw new Error("pode_divulgar da etapa final deveria ser 'não'");
      const linhaInter = linhas.find((l) => l.includes('"intermediaria"'));
      if (!linhaInter || !linhaInter.endsWith('"sim"')) throw new Error("pode_divulgar da intermediária deveria ser 'sim'");
      if (!resp.headers.get("content-disposition").includes("avaliacoes.csv")) throw new Error("nome do arquivo");
    });

    await passo("avaliação: POST /aluno/avaliacao valida sessão, Origin, etapa, nota e tamanho do comentário", async () => {
      const corpoOk = { etapa: "intermediaria", nota: 3, comentario: "ok", podeDivulgar: false };
      const semSessao = await fetch(`${baseUrl}/aluno/avaliacao`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(corpoOk),
      });
      if (![302, 401].includes(semSessao.status)) throw new Error(`sem sessão deu ${semSessao.status}`);

      const semOrigin = await alunoAval.ctx.request.post(`${baseUrl}/aluno/avaliacao`, { data: corpoOk });
      if (semOrigin.status() !== 403) throw new Error(`sem Origin deveria dar 403, deu ${semOrigin.status()}`);

      const casos = [
        ["etapa inválida", { ...corpoOk, etapa: "outra" }],
        ["nota 0", { ...corpoOk, nota: 0 }],
        ["nota 6", { ...corpoOk, nota: 6 }],
        ['nota "4" (string)', { ...corpoOk, nota: "4" }],
        ["nota 3.5", { ...corpoOk, nota: 3.5 }],
        ["comentário com 1001 caracteres", { ...corpoOk, comentario: "a".repeat(1001) }],
        ["comentário não-string", { ...corpoOk, comentario: 123 }],
        ["podeDivulgar não-booleano", { ...corpoOk, podeDivulgar: "sim" }],
      ];
      for (const [nome, corpo] of casos) {
        const r = await alunoAval.ctx.request.post(`${baseUrl}/aluno/avaliacao`, {
          data: corpo,
          headers: { Origin: baseUrl },
        });
        if (r.status() !== 400) throw new Error(`${nome}: esperava 400, veio ${r.status()}`);
      }
      const limite = await alunoAval.ctx.request.post(`${baseUrl}/aluno/avaliacao`, {
        data: { etapa: "intermediaria", nota: 5, comentario: "b".repeat(1000), podeDivulgar: true },
        headers: { Origin: baseUrl },
      });
      if (limite.status() !== 204) throw new Error(`1000 caracteres deveria ser aceito, veio ${limite.status()}`);
    });

    await passo("avaliação: ALUNO_AVAL sem erro de console", async () => {
      conferirSemErrosNoConsole(alunoAval.errosConsole, "avaliação (ALUNO_AVAL)");
    });
    await alunoAval.ctx.close();

    // ---- ALUNO_AVAL2: só Aula 1 concluída → cartão intermediário no /aluno + falha de rede ----
    const alunoAval2 = await abrirAlunoLogado(ALUNO_AVAL2, { width: 1280, height: 900 });

    await passo("avaliação: /aluno com Aula 1 concluída e sem resposta mostra só o cartão intermediário (prints)", async () => {
      const aula1 = await alunoAval2.ctx.newPage();
      aula1.on("pageerror", (erro) => alunoAval2.errosConsole.push(String(erro.message || erro)));
      await aula1.goto(`${baseUrl}/aluno/conteudo/${AULA1_ARQ}`);
      await aula1.evaluate(() => document.fonts.ready);
      await percorrerAula1Tema(aula1, { largura: 1280, print: false, prefixo: "aval2-aula1" });
      await esperarConcluida(aula1, AULA1_ARQ);

      const pagina = alunoAval2.pagina;
      await pagina.reload();
      const visiveis = pagina.locator(".avaliacao:visible");
      if ((await visiveis.count()) !== 1) throw new Error("esperava exatamente 1 cartão visível");
      if ((await visiveis.first().getAttribute("data-etapa")) !== "intermediaria") throw new Error("cartão deveria ser o intermediário");
      await printarAvaliacao(pagina, ".avaliacao:visible", "aluno-cartao-intermediario", { fullPage: true });
    });

    await passo("avaliação: estrelas — hover, teclado, foco visível, 360 px sem rolagem horizontal, toque e prints com 4 estrelas", async () => {
      const pagina = alunoAval2.pagina;
      const bloco = pagina.locator('.avaliacao[data-etapa="intermediaria"]');
      const cheias = () => bloco.locator(".nota.cheia").count();
      await bloco.scrollIntoViewIfNeeded();
      // hover pré-visualiza e volta ao sair
      await bloco.locator(".nota").nth(2).hover();
      if ((await cheias()) !== 3) throw new Error("hover na 3ª estrela deveria pintar 3");
      await pagina.mouse.move(5, 5);
      if ((await cheias()) !== 0) throw new Error("ao sair da escala sem nota, deveria voltar a 0");
      // teclado: setas mudam a nota e o preenchimento acompanha; foco visível
      await bloco.getByRole("radio", { name: "1 estrela" }).focus();
      await pagina.keyboard.press("ArrowRight");
      await pagina.keyboard.press("ArrowRight");
      if (!(await bloco.getByRole("radio", { name: "3 estrelas" }).isChecked())) throw new Error("setas deveriam marcar 3 estrelas");
      if ((await cheias()) !== 3) throw new Error("preenchimento deveria acompanhar o teclado (3)");
      const contorno = await bloco.locator(".nota").nth(2).locator("svg").evaluate((el) => getComputedStyle(el).outlineStyle);
      if (contorno === "none") throw new Error("foco por teclado sem contorno visível");
      // hover com nota escolhida: pré-visualiza e volta para a escolhida
      await bloco.locator(".nota").nth(4).hover();
      if ((await cheias()) !== 5) throw new Error("hover na 5ª deveria pintar 5");
      await pagina.mouse.move(5, 5);
      if ((await cheias()) !== 3) throw new Error("ao sair deveria voltar para a nota escolhida (3)");
      // 4 estrelas por clique + prints
      await bloco.locator(".nota").nth(3).click();
      if ((await cheias()) !== 4 || (await bloco.locator(".av-valor").textContent()) !== "4 de 5") throw new Error("4 estrelas / '4 de 5' esperados");
      await pagina.mouse.move(5, 5);
      await printarAvaliacao(pagina, ".avaliacao:visible", "aluno-cartao-4-estrelas", { fullPage: true });
      // 360 px sem rolagem horizontal
      await pagina.setViewportSize({ width: 360, height: 800 });
      const estouro = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (estouro > 0) throw new Error("rolagem horizontal em 360 px: " + estouro + "px");
      await pagina.setViewportSize({ width: 1280, height: 900 });
      // toque
      const ctxToque = await pagina.context().browser().newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, storageState: await pagina.context().storageState() });
      const toque = await ctxToque.newPage();
      await toque.goto(`${baseUrl}/aluno`);
      const blocoT = toque.locator('.avaliacao[data-etapa="intermediaria"]');
      await blocoT.locator(".nota").nth(3).tap();
      if ((await blocoT.locator(".nota.cheia").count()) !== 4) throw new Error("toque na 4ª estrela deveria pintar 4");
      if (await blocoT.locator(".av-enviar").isDisabled()) throw new Error("'Enviar' deveria habilitar após toque");
      await ctxToque.close();
      await pagina.reload();
    });

    await passo(
      "avaliação: POST falhando (abort) → mensagem de falha, valores preservados, aula segue navegável, sem pageerror",
      async () => {
        const pagina = alunoAval2.ctx.pages().find((p) => p.url().includes(AULA1_ARQ));
        await pagina.route("**/aluno/avaliacao", (rota) => rota.abort());
        const bloco = pagina.locator('.avaliacao[data-etapa="intermediaria"]');
        await bloco.scrollIntoViewIfNeeded();
        await preencherEEnviar(bloco, { nota: 2, comentario: "Faltou exemplo.", divulgar: true });
        await bloco.locator(".av-erro", { hasText: TEXTO_FALHA }).waitFor({ state: "visible" });
        if ((await bloco.locator("textarea").inputValue()) !== "Faltou exemplo.") throw new Error("comentário não foi preservado");
        if (!(await bloco.locator('input[name="nota"][value="2"]').isChecked())) throw new Error("nota não foi preservada");
        if (!(await bloco.locator('input[name="podeDivulgar"]').isChecked())) throw new Error("autorização não foi preservada");
        if (await bloco.locator(".av-enviar").isDisabled()) throw new Error("'Enviar' deveria voltar a habilitar");
        await printarAvaliacao(pagina, '.avaliacao[data-etapa="intermediaria"]', "aula1-falha");

        const linkAula2 = pagina.getByRole("link", { name: "Ir para a Aula 2" });
        if (!(await linkAula2.isVisible())) throw new Error("'Ir para a Aula 2' sumiu");
        if (!(await pagina.locator("#refazer").isVisible())) throw new Error("'Refazer a aula' sumiu");

        // tenta de novo com a rede de volta
        await pagina.unroute("**/aluno/avaliacao");
        await bloco.locator(".av-enviar").click();
        await bloco.locator(".av-ok", { hasText: TEXTO_OBRIGADO }).waitFor({ state: "visible" });

        await linkAula2.click();
        await pagina.waitForURL(/Aula2_Conserte_a_Resposta\.html/);
      }
    );

    await passo("avaliação: depois de responder, o cartão do /aluno some após reload; sem erro de console", async () => {
      const pagina = alunoAval2.pagina;
      await pagina.reload();
      if ((await pagina.locator(".avaliacao:visible").count()) !== 0) throw new Error("cartão voltou depois de responder");
      conferirSemErrosNoConsole(alunoAval2.errosConsole, "avaliação (ALUNO_AVAL2)");
    });
    await alunoAval2.ctx.close();

    // ---- ALUNO_MANUAL: Aulas 1 e 3 concluídas, sem resposta → só o cartão final ----
    await passo("avaliação: /aluno com Aula 3 concluída e sem 'final' mostra só o cartão final; enviar → agradece e não volta", async () => {
      const { ctx, pagina, errosConsole } = await abrirAlunoLogado(ALUNO_MANUAL, { width: 1280, height: 900 });
      try {
        const visiveis = pagina.locator(".avaliacao:visible");
        if ((await visiveis.count()) !== 1) throw new Error(`esperava 1 cartão visível, veio ${await visiveis.count()}`);
        if ((await visiveis.first().getAttribute("data-etapa")) !== "final") throw new Error("cartão deveria ser o final");
        await printarAvaliacao(pagina, ".avaliacao:visible", "aluno-cartao-final", { fullPage: true });

        const bloco = pagina.locator('.avaliacao[data-etapa="final"]');
        await preencherEEnviar(bloco, { nota: 4, comentario: "", divulgar: false });
        await bloco.locator(".av-ok", { hasText: TEXTO_OBRIGADO }).waitFor({ state: "visible" });
        // voltar à aba não pode esconder o agradecimento
        await pagina.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await new Promise((r) => setTimeout(r, 500));
        if (!(await bloco.locator(".av-ok").isVisible())) throw new Error("agradecimento sumiu ao voltar à aba");

        await pagina.reload();
        if ((await pagina.locator(".avaliacao:visible").count()) !== 0) throw new Error("cartão voltou após o reload");
        conferirSemErrosNoConsole(errosConsole, "avaliação (cartão final)");
      } finally {
        await ctx.close();
      }
    });

    await passo("avaliação: /privacidade cita as avaliações do curso", async () => {
      const html = await (await fetch(`${baseUrl}/privacidade`)).text();
      if (!html.includes("avaliações do curso") || !html.includes("primeiro nome")) throw new Error("texto de privacidade ausente");
    });

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

    // ---------- tarefa 15: registros de teste (users.is_teste) ficam fora dos relatórios ----------
    const ALUNO_TESTE = {
      nome: "Zeta Teste Oculto E2E",
      email: `zeta.teste.oculto.${SUFIXO}@exemplo.com`,
      whatsapp: "11999990007",
      senha: "senha-teste-oculto-1234",
      valor: "49,90",
    };
    const alunoTeste = { ctx: null };
    const reTotal = /<div class="valor">(\d+)<\/div><div class="rotulo">Pedidos pagos/;
    const reSoma = /<div class="valor">(R\$[^<]+)<\/div><div class="rotulo">Total em vendas/;

    await passo("teste oculto: aluno de teste aparece no /admin antes de ser marcado", async () => {
      await cadastrarAlunoManual(ALUNO_TESTE);
      const sessao = await abrirAlunoLogado(ALUNO_TESTE, { width: 1280, height: 900 });
      alunoTeste.ctx = sessao.ctx;
      const cab = { Origin: baseUrl };
      const prog = await sessao.ctx.request.post(`${baseUrl}/aluno/progresso`, {
        data: { aula: "Aula1_O_Pedido_que_Funciona.html", passo: 1, total: 1 },
        headers: cab,
      });
      if (prog.status() !== 204) throw new Error(`progresso deu ${prog.status()}`);
      const av = await sessao.ctx.request.post(`${baseUrl}/aluno/avaliacao`, {
        data: { etapa: "final", nota: 1, comentario: "comentario-do-teste-oculto", podeDivulgar: false },
        headers: cab,
      });
      if (av.status() !== 204) throw new Error(`avaliação deu ${av.status()}`);
      const html = await adminHtml();
      if (!html.includes(ALUNO_TESTE.email)) throw new Error("aluno ainda não marcado deveria aparecer no /admin");
    });

    await passo("teste oculto: is_teste=1 some de lista, totais, CSVs, uso do conteúdo e avaliações; nada é apagado", async () => {
      const antes = await adminHtml();
      const totalAntes = Number(antes.match(reTotal)[1]);
      const somaAntes = antes.match(reSoma)[1];
      const csvAntes = await (await fetch(`${baseUrl}/admin/avaliacoes.csv`, { headers: { Authorization: AUTH_ADMIN } })).text();
      if (!csvAntes.includes("comentario-do-teste-oculto")) throw new Error("avaliação deveria estar no CSV antes de marcar");

      // fixture: marca direto no arquivo do banco de teste (o app só marca os e-mails de produção no boot)
      const Database = require("better-sqlite3");
      const conn = new Database(dbPath);
      try {
        const info = conn.prepare("UPDATE users SET is_teste = 1 WHERE email = ?").run(ALUNO_TESTE.email);
        if (info.changes !== 1) throw new Error(`marcou ${info.changes} linhas`);
      } finally {
        conn.close();
      }

      const html = await adminHtml();
      if (html.includes(`<td>${ALUNO_TESTE.email}</td>`) || html.includes(ALUNO_TESTE.nome) || html.includes("comentario-do-teste-oculto")) {
        throw new Error("registro de teste ainda aparece no /admin");
      }
      if (Number(html.match(reTotal)[1]) !== totalAntes - 1) throw new Error("total de pagos não caiu em 1");
      if (html.match(reSoma)[1] === somaAntes) throw new Error("soma em R$ não mudou");
      for (const csv of ["vendas.csv", "avaliacoes.csv"]) {
        const txt = await (await fetch(`${baseUrl}/admin/${csv}`, { headers: { Authorization: AUTH_ADMIN } })).text();
        if (txt.includes(ALUNO_TESTE.email)) throw new Error(`${csv} ainda tem o registro de teste`);
      }
      const comTestes = await (await fetch(`${baseUrl}/admin?testes=1`, { headers: { Authorization: AUTH_ADMIN } })).text();
      if (!comTestes.includes(`<td>${ALUNO_TESTE.email}</td>`)) throw new Error("?testes=1 deveria mostrar o registro");
      if (Number(comTestes.match(reTotal)[1]) !== totalAntes) throw new Error("?testes=1 deveria voltar ao total anterior");

      const conn2 = new Database(dbPath, { readonly: true });
      try {
        const n = conn2.prepare("SELECT COUNT(*) AS n FROM users WHERE email = ?").get(ALUNO_TESTE.email).n;
        const o = conn2
          .prepare("SELECT COUNT(*) AS n FROM orders JOIN users ON users.id = orders.user_id WHERE users.email = ?")
          .get(ALUNO_TESTE.email).n;
        if (n !== 1 || o !== 1) throw new Error("linhas do teste foram removidas do banco");
      } finally {
        conn2.close();
      }
    });

    await passo("teste oculto: comprador de teste ainda loga e acessa /aluno", async () => {
      const pagina = await alunoTeste.ctx.newPage();
      await pagina.goto(`${baseUrl}/aluno`);
      if (!pagina.url().endsWith("/aluno")) throw new Error(`redirecionou para ${pagina.url()}`);
      await pagina.close();
      const novo = await abrirAlunoLogado(ALUNO_TESTE, { width: 1280, height: 900 });
      await novo.pagina.goto(`${baseUrl}/aluno`);
      if (!novo.pagina.url().endsWith("/aluno")) throw new Error(`novo login foi para ${novo.pagina.url()}`);
      await novo.ctx.close();
      await alunoTeste.ctx.close();
      await ctxAdminAv.close();
    });
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
