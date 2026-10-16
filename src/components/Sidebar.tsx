"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, getProjetoIdsDoUsuario, isAdminGeral, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { buscarDbRemoto } from "@/lib/github-sync";
import SidebarNavLink from "@/components/SidebarNavLink";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const db = useDb();
  const pathname = usePathname();
  const [syncAtivo, setSyncAtivo] = useState<boolean | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!user || !isAdminGeral(user)) return;
    let cancelado = false;
    buscarDbRemoto().then((resultado) => {
      if (!cancelado) setSyncAtivo(resultado.existe === true);
    });
    return () => { cancelado = true; };
  }, [user]);

  if (!user || !db || pathname === "/login" || pathname.startsWith("/responder")) return null;

  const isAdmin = user.papel === "ADMIN";
  const projetoIds = isAdmin ? null : getProjetoIdsDoUsuario(user.id);
  const projetos = db.projetos
    .filter((p) => (isAdmin ? true : projetoIds?.includes(p.id)))
    .slice().sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <>
      <button type="button" className="mobile-menu-button" aria-label={aberto ? "Fechar navegação" : "Abrir navegação"} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? "×" : "☰"}
      </button>
      {aberto && <button className="fixed inset-0 z-20 bg-slate-950/35 md:hidden" aria-label="Fechar menu" onClick={() => setAberto(false)} />}
      <aside className="app-sidebar" data-open={aberto}>
        <Link href="/" className="brand-lockup" aria-label="3Pontos Company — início">
          <Image src="/3pontos-company.jpg" alt="Logo 3Pontos Company" width={54} height={54} />
          <span><strong>3PONTOS</strong><small>Company · HealthScore</small></span>
        </Link>

        <nav className="sidebar-nav" aria-label="Navegação principal" onClick={() => setAberto(false)}>
          <div className="nav-section">Visão geral</div>
          {temPermissao(user, "verDashboard") && <SidebarNavLink href="/" exact>▦　Dashboard</SidebarNavLink>}
          {temPermissao(user, "verProjetos") && <SidebarNavLink href="/projetos">◫　Projetos</SidebarNavLink>}
          {temPermissao(user, "verClientes") && <SidebarNavLink href="/clientes">♧　Clientes</SidebarNavLink>}
          {isAdmin && <>
            <div className="nav-section">Administração</div>
            <SidebarNavLink href="/admin/usuarios">♙　Usuários e acessos</SidebarNavLink>
            <SidebarNavLink href="/admin/saidas">↗　Relatório de saídas</SidebarNavLink>
          </>}
          {isAdminGeral(user) && <SidebarNavLink href="/admin/github">⟳　Sincronização</SidebarNavLink>}
          {projetos.length > 0 && <>
            <div className="nav-section">{isAdmin ? "Seus projetos" : "Projetos permitidos"}</div>
            {projetos.map((p) => <SidebarNavLink key={p.id} href={`/projetos/detalhe?id=${p.id}`}>{p.nome}</SidebarNavLink>)}
          </>}
        </nav>

        <footer className="sidebar-footer">
          {isAdminGeral(user) && <div className="sync-indicator"><i />{syncAtivo === true ? "Dados sincronizados" : syncAtivo === false ? "Sincronização indisponível" : "Verificando conexão…"}</div>}
          <div className="profile-name">{user.nome}</div>
          <div className="profile-role">{isAdminGeral(user) ? "Admin Geral" : user.papel === "ADMIN" ? "Administrador" : "Equipe 3Pontos"}</div>
          <button type="button" onClick={logout}>Sair da conta　↗</button>
        </footer>
      </aside>
    </>
  );
}
