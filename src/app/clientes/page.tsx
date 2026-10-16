"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, getProjetoIdsDoUsuario, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, excluirCliente } from "@/lib/store";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";

export default function ClientesPage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const [busca, setBusca] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  if (!pronto || !db || !user) return null;
  if (!temPermissao(user, "verClientes")) return <p className="text-sm text-neutral-500">Você não tem permissão para visualizar clientes.</p>;
  const podeGerenciar = temPermissao(user, "gerenciarClientes");
  const projetosPermitidos = user.papel === "ADMIN" ? null : new Set(getProjetoIdsDoUsuario(user.id));

  function handleExcluir(clienteId: string, nome: string) {
    const confirmado = window.confirm(
      `Excluir "${nome}" definitivamente? Isso apaga também respostas, ciclos e histórico desse cliente (o projeto continua). Não pode ser desfeito.`
    );
    if (!confirmado) return;
    mutateDb((dbW) => excluirCliente(dbW, clienteId));
  }

  const projetos = db.projetos.filter((p) => !projetosPermitidos || projetosPermitidos.has(p.id)).slice().sort((a, b) => a.nome.localeCompare(b.nome));

  const termoBusca = busca.trim().toLowerCase();
  const clientes = db.clientes
    .filter((c) => (!projetosPermitidos || projetosPermitidos.has(c.projetoId)) && (filtroProjeto ? c.projetoId === filtroProjeto : true) && (!filtroStatus || c.status === filtroStatus))
    .filter((c) => (termoBusca ? c.nome.toLowerCase().includes(termoBusca) : true))
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((cliente) => {
      const projeto = db.projetos.find((p) => p.id === cliente.projetoId);
      const risco = db.riscosChurn
        .filter((r) => r.clienteId === cliente.id)
        .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0];
      return { cliente, projeto, risco };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Relacionamento</p><h1>Clientes <span className="text-base font-medium text-neutral-400">{clientes.length}</span></h1><p className="mb-0 mt-2 text-sm text-neutral-500">Consulte status, projeto e avaliação mais recente.</p></div>
        {podeGerenciar && <Link href="/clientes/novo" className="action-button action-primary">+ Novo cliente</Link>}
      </div>

      <div className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_220px_180px]">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar cliente"
          placeholder="Buscar por nome..."
          className="min-w-[200px]"
        />
        <select
          value={filtroProjeto}
          onChange={(e) => setFiltroProjeto(e.target.value)}
          aria-label="Filtrar por projeto"
        >
          <option value="">Todos os projetos</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label="Filtrar por status">
          <option value="">Todos os status</option><option value="ATIVO">Ativo</option><option value="EM_RISCO">Em risco</option><option value="INATIVO">Inativo</option>
        </select>
      </div>

      <div className="grid gap-3">
        {clientes.map(({ cliente, projeto, risco }) => (
          <Card key={cliente.id} className="client-list-card hover:border-neutral-400 transition flex items-center justify-between gap-4">
            <Link href={`/clientes/detalhe?id=${cliente.id}`} className="action-card-link flex-1 min-w-0 rounded-md p-1">
              <div className="font-medium text-neutral-900">{cliente.nome}</div>
              <div className="text-sm text-neutral-500">
                {projeto?.nome ?? "Sem projeto"} · {cliente.segmento ?? "Sem segmento"}
              </div>
            </Link>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StatusBadge status={cliente.status} />
              <RiscoBadge nivel={risco?.nivelRisco} />
              {podeGerenciar && <button onClick={() => handleExcluir(cliente.id, cliente.nome)} className="inline-action inline-action-danger">Excluir</button>}
            </div>
          </Card>
        ))}
        {clientes.length === 0 && <div className="empty-state"><span>♧</span><p>Nenhum cliente encontrado.</p><small>Altere os filtros para ver outros clientes{podeGerenciar ? " ou cadastre um novo cliente." : "."}</small></div>}
      </div>
    </div>
  );
}
