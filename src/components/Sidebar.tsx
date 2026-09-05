"use client";

import { useAuth, getProjetoIdsDoUsuario } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { getGithubConfig } from "@/lib/github-sync";
import SidebarNavLink from "@/components/SidebarNavLink";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const db = useDb();

  if (!user || !db) return null;

  const isAdmin = user.papel === "ADMIN";
  const projetoIds = isAdmin ? null : getProjetoIdsDoUsuario(user.id);
  const githubConfig = getGithubConfig();

  const projetos = db.projetos
    .filter((p) => (isAdmin ? true : projetoIds?.includes(p.id)))
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white min-h-screen flex flex-col">
      <div className="px-4 py-4 border-b border-neutral-200">
        <a href="/" className="text-base font-semibold text-neutral-900">
          Saúde de Clientes
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <SidebarNavLink href="/" exact>
          Dashboard
        </SidebarNavLink>
        <SidebarNavLink href="/projetos">Projetos</SidebarNavLink>
        <SidebarNavLink href="/admin/github">Sincronização GitHub</SidebarNavLink>
        {isAdmin && (
          <>
            <SidebarNavLink href="/clientes">Clientes</SidebarNavLink>
            <SidebarNavLink href="/admin/usuarios">Usuários</SidebarNavLink>
            <SidebarNavLink href="/admin/saidas">Motivos de Saída</SidebarNavLink>
          </>
        )}

        {projetos.length > 0 && (
          <div className="pt-4 mt-4 border-t border-neutral-100">
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {isAdmin ? "Todos os projetos" : "Meus projetos"}
            </p>
            {projetos.map((p) => (
              <SidebarNavLink key={p.id} href={`/projetos/detalhe?id=${p.id}`}>
                {p.nome}
              </SidebarNavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-neutral-200 text-sm">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${githubConfig ? "bg-emerald-500" : "bg-neutral-300"}`} />
          {githubConfig ? `Sincronizado: ${githubConfig.owner}/${githubConfig.repo}` : "GitHub não conectado"}
        </div>
        <div className="mb-2 text-neutral-700">
          {user.nome} <span className="block text-xs uppercase text-neutral-400">{user.papel}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-neutral-500 hover:text-neutral-900 underline text-sm"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
