"use client";

// Sincroniza os dados do app com um arquivo JSON dentro de um repositório
// GitHub (via API REST de Conteúdo). O token de acesso fica salvo só no
// localStorage deste navegador — nunca no código-fonte do site.
//
// Fluxo:
// - Ao iniciar o app, busca o arquivo mais recente no GitHub e substitui os
//   dados locais por ele (se o arquivo ainda não existir, cria a partir dos
//   dados locais atuais).
// - Sempre que algo muda localmente, agenda (com um pequeno atraso) o envio
//   da versão atual para o GitHub.

import { useEffect, useRef } from "react";
import { getDb, substituirDb, garantirSeed } from "./store";
import type { Database } from "./types";

const CONFIG_KEY = "calculadora-churn-github-config-v1";
const SHA_KEY = "calculadora-churn-github-sha-v1";
const DATA_PATH = "data/db.json";

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function getGithubConfig(): GithubConfig | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as GithubConfig) : null;
  } catch {
    return null;
  }
}

export function setGithubConfig(cfg: GithubConfig) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  window.localStorage.removeItem(SHA_KEY);
}

export function limparGithubConfig() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CONFIG_KEY);
  window.localStorage.removeItem(SHA_KEY);
}

function getSha(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(SHA_KEY);
}

function setSha(sha: string | null) {
  if (!isBrowser()) return;
  if (sha) window.localStorage.setItem(SHA_KEY, sha);
  else window.localStorage.removeItem(SHA_KEY);
}

/** Registra o sha do último conteúdo remoto conhecido (uso após buscar manualmente). */
export function registrarShaConhecido(sha: string) {
  setSha(sha);
}

function utf8ParaBase64(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario);
}

function base64ParaUtf8(base64: string) {
  const binario = atob(base64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function apiUrlConteudo(cfg: GithubConfig) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
}

function headers(cfg: GithubConfig) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
  };
}

export async function testarConexao(cfg: GithubConfig): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const resp = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, {
      headers: headers(cfg),
    });
    if (resp.status === 404) {
      return { ok: false, erro: "Repositório não encontrado. Confira o usuário e o nome do repositório." };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, erro: "Token inválido ou sem permissão nesse repositório. Confira o token gerado." };
    }
    if (!resp.ok) {
      return { ok: false, erro: `Erro ao conectar (status ${resp.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao GitHub. Verifique sua internet." };
  }
}

type ResultadoBusca =
  | { existe: true; db: Database; sha: string }
  | { existe: false }
  | { existe: null; erro: string };

export async function buscarDbRemoto(cfg: GithubConfig): Promise<ResultadoBusca> {
  try {
    const resp = await fetch(`${apiUrlConteudo(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
      headers: headers(cfg),
      cache: "no-store",
    });
    if (resp.status === 404) return { existe: false };
    if (!resp.ok) return { existe: null, erro: `Erro ao buscar dados no GitHub (status ${resp.status}).` };
    const json = await resp.json();
    const conteudo = base64ParaUtf8(json.content as string);
    const db = JSON.parse(conteudo) as Database;
    return { existe: true, db, sha: json.sha as string };
  } catch {
    return { existe: null, erro: "Não foi possível conectar ao GitHub. Verifique sua internet." };
  }
}

export async function salvarDbRemoto(cfg: GithubConfig, db: Database): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const body: Record<string, unknown> = {
      message: `Atualiza dados - ${new Date().toISOString()}`,
      content: utf8ParaBase64(JSON.stringify(db, null, 2)),
      branch: cfg.branch,
    };
    const shaAtual = getSha();
    if (shaAtual) body.sha = shaAtual;

    let resp = await fetch(apiUrlConteudo(cfg), {
      method: "PUT",
      headers: { ...headers(cfg), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // sha desatualizado (outro dispositivo salvou antes) -> busca o sha
    // mais recente e tenta salvar de novo, uma única vez.
    if (resp.status === 409 || resp.status === 422) {
      const remoto = await buscarDbRemoto(cfg);
      if (remoto.existe === true) {
        body.sha = remoto.sha;
        resp = await fetch(apiUrlConteudo(cfg), {
          method: "PUT",
          headers: { ...headers(cfg), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      return { ok: false, erro: `Erro ao salvar no GitHub (status ${resp.status}). ${texto.slice(0, 150)}` };
    }
    const json = await resp.json();
    setSha((json.content?.sha as string) ?? null);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao GitHub. Verifique sua internet." };
  }
}

let sincronizando = false;

/**
 * Chamado uma vez ao carregar o app. Se houver integração configurada,
 * busca os dados mais recentes do GitHub e substitui os dados locais. Se o
 * arquivo ainda não existir no repositório, cria a partir dos dados locais
 * atuais (semeando dados de exemplo se estiver tudo vazio).
 */
export async function sincronizarNaInicializacao(): Promise<void> {
  const cfg = getGithubConfig();
  if (!cfg) {
    garantirSeed();
    return;
  }

  const remoto = await buscarDbRemoto(cfg);
  sincronizando = true;
  try {
    if (remoto.existe === true) {
      substituirDb(remoto.db);
      setSha(remoto.sha);
    } else {
      garantirSeed();
    }
  } finally {
    sincronizando = false;
  }

  if (remoto.existe === false) {
    await salvarDbRemoto(cfg, getDb());
  }
}

/**
 * Hook que salva automaticamente no GitHub (com um pequeno atraso) sempre
 * que os dados locais mudam, caso a integração esteja configurada. Sem
 * integração configurada, não faz nada.
 */
export function useGithubAutoSync() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function agendarSalvar() {
      if (sincronizando) return;
      const cfg = getGithubConfig();
      if (!cfg) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        salvarDbRemoto(cfg, getDb());
      }, 2500);
    }
    window.addEventListener("calculadora-db-changed", agendarSalvar);
    return () => {
      window.removeEventListener("calculadora-db-changed", agendarSalvar);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
}
