"use client";

// Substitui o NextAuth do projeto original. Sem servidor, a "sessão" é só um
// registro simples salvo no localStorage do navegador. Não é um mecanismo de
// segurança forte (é um app estático, sem backend) — serve para controlar
// quem vê o quê dentro da própria interface, como pedido pelo usuário.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb } from "./store";
import { sincronizarNaInicializacao } from "./github-sync";
import type { PapelUsuario } from "./types";

const SESSION_KEY = "calculadora-churn-session-v1";

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
}

interface AuthContextValue {
  user: SessionUser | null;
  pronto: boolean;
  login: (email: string, senha: string) => { ok: true } | { ok: false; erro: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function lerSessao(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

// Rotas públicas: /login e /responder (link enviado direto ao cliente, sem login).
function rotaPublica(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/responder");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pronto, setPronto] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      await sincronizarNaInicializacao();
      if (cancelado) return;
      setUser(lerSessao());
      setPronto(true);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const login = useCallback((email: string, senha: string): { ok: true } | { ok: false; erro: string } => {
    const db = getDb();
    const usuario = db.usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!usuario || !bcrypt.compareSync(senha, usuario.senhaHash)) {
      return { ok: false, erro: "Email ou senha inválidos." };
    }
    const sessionUser: SessionUser = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    router.push("/login");
  }, [router]);

  // Guarda de rota: sem sessão -> /login; com sessão em /login -> "/".
  useEffect(() => {
    if (!pronto) return;
    if (!user && !rotaPublica(pathname)) {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [pronto, user, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, pronto, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function getProjetoIdsDoUsuario(usuarioId: string): string[] {
  const db = getDb();
  return db.acessosProjeto.filter((a) => a.usuarioId === usuarioId).map((a) => a.projetoId);
}

export function podeAcessarProjeto(user: SessionUser, projetoId: string): boolean {
  if (user.papel === "ADMIN") return true;
  return getProjetoIdsDoUsuario(user.id).includes(projetoId);
}
