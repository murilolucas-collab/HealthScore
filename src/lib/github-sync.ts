"use client";

// Sincroniza os dados do app com um arquivo JSON num repositório GitHub —
// através da nossa própria rota de API (/api/data), que roda no servidor.
// O navegador NUNCA vê o token do GitHub: ele fica só nas variáveis de
// ambiente da Vercel, usadas pela função serverless em api/data/route.ts.
//
// Fluxo:
// - Ao iniciar o app, busca o arquivo mais recente e substitui os dados
//   locais por ele (se ainda não existir, cria a partir dos dados locais).
// - Sempre que algo muda localmente, agenda (com um pequeno atraso) o envio
//   da versão atual.

import { useEffect, useRef } from "react";
import { getDb, substituirDb, garantirSeed } from "./store";
import type { Database } from "./types";

const SHA_KEY = "calculadora-churn-github-sha-v1";

function isBrowser() {
  return typeof window !== "undefined";
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

type ResultadoBusca =
  | { existe: true; db: Database; sha: string }
  | { existe: false }
  | { existe: null; erro: string };

export async function buscarDbRemoto(): Promise<ResultadoBusca> {
  try {
    const resp = await fetch("/api/data", { cache: "no-store" });
    const json = await resp.json();
    if (!resp.ok) {
      return { existe: null, erro: json.error ?? `Erro ao buscar dados (status ${resp.status}).` };
    }
    if (json.existe === false) return { existe: false };
    return { existe: true, db: json.db as Database, sha: json.sha as string };
  } catch {
    return { existe: null, erro: "Não foi possível conectar ao servidor." };
  }
}

export async function salvarDbRemoto(db: Database): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const sha = getSha();
    const resp = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ db, sha }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, erro: json.error ?? `Erro ao salvar (status ${resp.status}).` };
    }
    setSha(json.sha ?? null);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao servidor." };
  }
}

let sincronizando = false;

/**
 * Chamado uma vez ao carregar o app. Busca os dados mais recentes e
 * substitui os dados locais. Se o arquivo ainda não existir no
 * repositório, cria a partir dos dados locais atuais (semeando dados de
 * exemplo se estiver tudo vazio). Se a sincronização não estiver
 * configurada no servidor (variáveis de ambiente ausentes), o app segue
 * funcionando normalmente só com os dados locais.
 */
export async function sincronizarNaInicializacao(): Promise<void> {
  const remoto = await buscarDbRemoto();
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
    await salvarDbRemoto(getDb());
  }
}

/**
 * Hook que salva automaticamente (com um pequeno atraso) sempre que os
 * dados locais mudam. Sem sincronização configurada no servidor, as
 * tentativas de salvar simplesmente falham em silêncio e o app continua
 * funcionando só localmente.
 */
export function useGithubAutoSync() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function agendarSalvar() {
      if (sincronizando) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        salvarDbRemoto(getDb());
      }, 2500);
    }
    window.addEventListener("calculadora-db-changed", agendarSalvar);
    return () => {
      window.removeEventListener("calculadora-db-changed", agendarSalvar);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
}
