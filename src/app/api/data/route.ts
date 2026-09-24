import { NextResponse } from "next/server";

// Esta rota roda só no servidor (função serverless da Vercel). O token do
// GitHub vive aqui como variável de ambiente (GITHUB_TOKEN, sem o prefixo
// NEXT_PUBLIC_), então ele nunca é enviado ao navegador de quem usa o site
// — só esta função conversa diretamente com a API do GitHub.
//
// Variáveis de ambiente necessárias (configuradas no painel da Vercel, em
// Project Settings → Environment Variables):
// - GITHUB_OWNER  (ex: murilolucas-collab)
// - GITHUB_REPO   (ex: HealthScore)
// - GITHUB_BRANCH (ex: main — opcional, padrão "main")
// - GITHUB_TOKEN  (o Personal Access Token com permissão Contents: Read/write)

const DATA_PATH = "data/db.json";

interface ServerConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function getConfig(): ServerConfig | null {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!owner || !repo || !token) return null;
  return { owner, repo, branch, token };
}

function apiUrlConteudo(cfg: ServerConfig) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
}

function githubHeaders(cfg: ServerConfig) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
  };
}

export async function GET() {
  const cfg = getConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Sincronização não configurada no servidor (faltam variáveis de ambiente)." },
      { status: 501 }
    );
  }

  try {
    const resp = await fetch(`${apiUrlConteudo(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
      headers: githubHeaders(cfg),
      cache: "no-store",
    });

    if (resp.status === 404) {
      return NextResponse.json({ existe: false });
    }
    if (!resp.ok) {
      return NextResponse.json({ error: `Erro ao buscar dados no GitHub (status ${resp.status}).` }, { status: 502 });
    }

    const json = await resp.json();
    const conteudo = Buffer.from(json.content as string, "base64").toString("utf-8");
    const db = JSON.parse(conteudo);
    return NextResponse.json({ existe: true, db, sha: json.sha as string });
  } catch {
    return NextResponse.json({ error: "Não foi possível conectar ao GitHub." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const cfg = getConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Sincronização não configurada no servidor (faltam variáveis de ambiente)." },
      { status: 501 }
    );
  }

  try {
    const payload = await request.json();
    const db = payload?.db;
    const shaRecebido = typeof payload?.sha === "string" ? payload.sha : null;

    if (!db) {
      return NextResponse.json({ error: "Dados ausentes na requisição." }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      message: `Atualiza dados - ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(db, null, 2), "utf-8").toString("base64"),
      branch: cfg.branch,
    };
    if (shaRecebido) body.sha = shaRecebido;

    let resp = await fetch(apiUrlConteudo(cfg), {
      method: "PUT",
      headers: { ...githubHeaders(cfg), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // sha desatualizado (outro dispositivo salvou antes) -> busca o sha
    // mais recente e tenta salvar de novo, uma única vez.
    if (resp.status === 409 || resp.status === 422) {
      const getResp = await fetch(`${apiUrlConteudo(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
        headers: githubHeaders(cfg),
        cache: "no-store",
      });
      if (getResp.ok) {
        const getJson = await getResp.json();
        body.sha = getJson.sha;
        resp = await fetch(apiUrlConteudo(cfg), {
          method: "PUT",
          headers: { ...githubHeaders(cfg), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Erro ao salvar no GitHub (status ${resp.status}). ${texto.slice(0, 150)}` },
        { status: 502 }
      );
    }

    const json = await resp.json();
    return NextResponse.json({ ok: true, sha: json.content?.sha ?? null });
  } catch {
    return NextResponse.json({ error: "Não foi possível conectar ao GitHub." }, { status: 502 });
  }
}
