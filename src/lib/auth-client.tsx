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
import type { FuncaoCliente, FuncaoContato, ModuloUsuario, PapelUsuario, Usuario } from "./types";

const SESSION_KEY = "calculadora-churn-session-v1";

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
}

export const PERMISSOES_PADRAO: Record<ModuloUsuario, boolean> = {
  verDashboard: true,
  verProjetos: true,
  verClientes: true,
  gerenciarClientes: false,
  calcularSaude: true,
};

export const PERMISSOES_TOTAIS: Record<ModuloUsuario, boolean> = {
  verDashboard: true,
  verProjetos: true,
  verClientes: true,
  gerenciarClientes: true,
  calcularSaude: true,
};

export const FUNCOES_CLIENTES_TOTAIS: Record<FuncaoCliente, boolean> = {
  visualizar: true,
  alterarStatus: true,
};

export const FUNCOES_CONTATOS_TOTAIS: Record<FuncaoContato, boolean> = {
  visualizar: true,
  gerenciar: true,
  gerenciarMetasEventos: true,
};

export function isAdminGeral(user: Pick<SessionUser, "nome" | "email" | "papel">) {
  // O nome é editável e não pode conceder privilégios. O email-raiz é único
  // (a criação de usuários rejeita duplicatas) e permanece como identificador
  // legado do Admin Geral até a migração para autenticação com papéis no servidor.
  return user.papel === "ADMIN" && user.email.trim().toLowerCase() === "admin@agencia.com";
}

export function permissoesEfetivas(
  usuario: Pick<Usuario, "nome" | "email" | "papel" | "permissoes">
): Record<ModuloUsuario, boolean> {
  // O Admin Geral é o único perfil que não pode ser limitado por módulos.
  if (isAdminGeral(usuario)) return PERMISSOES_TOTAIS;

  // Mantém administradores antigos funcionando durante a migração do schema.
  // Assim que o Admin editar os módulos, o registro passa a ser individual.
  if (usuario.papel === "ADMIN" && !usuario.permissoes) return PERMISSOES_TOTAIS;

  return { ...PERMISSOES_PADRAO, ...(usuario.permissoes ?? {}) };
}

export function funcoesClientesEfetivas(
  usuario: Pick<Usuario, "nome" | "email" | "papel" | "permissoes">
): Record<FuncaoCliente, boolean> {
  if (isAdminGeral(usuario) || (usuario.papel === "ADMIN" && !usuario.permissoes)) return FUNCOES_CLIENTES_TOTAIS;
  const modulos = permissoesEfetivas(usuario);
  return {
    visualizar: modulos.verClientes,
    alterarStatus: modulos.gerenciarClientes,
    ...(usuario.permissoes?.clientes ?? {}),
  };
}

export function funcoesContatosEfetivas(
  usuario: Pick<Usuario, "nome" | "email" | "papel" | "permissoes">
): Record<FuncaoContato, boolean> {
  if (isAdminGeral(usuario) || (usuario.papel === "ADMIN" && !usuario.permissoes)) return FUNCOES_CONTATOS_TOTAIS;
  const modulos = permissoesEfetivas(usuario);
  return {
    visualizar: modulos.verClientes,
    gerenciar: modulos.gerenciarClientes,
    gerenciarMetasEventos: modulos.gerenciarClientes,
    ...(usuario.permissoes?.contatos ?? {}),
  };
}

export function temFuncaoCliente(user: SessionUser, funcao: FuncaoCliente) {
  const usuario = getDb().usuarios.find((u) => u.id === user.id);
  return funcoesClientesEfetivas(usuario ?? user)[funcao];
}

export function temFuncaoContato(user: SessionUser, funcao: FuncaoContato) {
  const usuario = getDb().usuarios.find((u) => u.id === user.id);
  return funcoesContatosEfetivas(usuario ?? user)[funcao];
}

export function temPermissao(user: SessionUser, modulo: ModuloUsuario) {
  const usuario = getDb().usuarios.find((u) => u.id === user.id);
  return permissoesEfetivas(usuario ?? user)[modulo];
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
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return [];
  if (isAdminGeral(usuario)) return db.projetos.map((projeto) => projeto.id);
  // Compatibilidade: admins criados antes do escopo por projeto tinham acesso
  // global. O marcador vira true somente quando o escopo é salvo explicitamente.
  if (usuario.papel === "ADMIN" && usuario.escopoProjetosConfigurado !== true) {
    return db.projetos.map((projeto) => projeto.id);
  }
  return db.acessosProjeto.filter((a) => a.usuarioId === usuarioId).map((a) => a.projetoId);
}

export function podeAcessarProjeto(user: SessionUser, projetoId: string): boolean {
  // Admin Geral é o único usuário com acesso implícito a toda a carteira.
  // Para todos os demais, inclusive ADMIN, a relação individual é obrigatória.
  if (isAdminGeral(user)) return true;
  return getProjetoIdsDoUsuario(user.id).includes(projetoId);
}
