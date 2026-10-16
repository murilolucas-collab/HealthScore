"use client";

import Link from "next/link";
import { useAuth, getProjetoIdsDoUsuario, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, excluirProjeto } from "@/lib/store";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";
import { useState } from "react";
import { obterResumoSaudeProjeto } from "@/lib/churn";

const ORDEM_RISCO = ["CRITICO", "ALTO", "MEDIO", "BAIXO"] as const;

export default function ProjetosPage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  if (!pronto || !db || !user) return null;
  if (!temPermissao(user, "verProjetos")) {
    return <p className="text-sm text-neutral-500">Você não tem permissão para visualizar projetos.</p>;
  }

  const isAdmin = user.papel === "ADMIN";
  const projetoIds = isAdmin ? null : getProjetoIdsDoUsuario(user.id);

  const projetos = db.projetos
    .filter((p) => (isAdmin ? true : projetoIds?.includes(p.id)))
    .map((p) => {
      const clientesDoProjeto = db.clientes.filter((c) => c.projetoId === p.id);
      const niveis = clientesDoProjeto
        .map(
          (c) =>
            db.riscosChurn
              .filter((r) => r.clienteId === c.id)
              .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0]?.nivelRisco
        )
        .filter(Boolean);
      const piorRisco = ORDEM_RISCO.find((n) => niveis.includes(n as never));
      return { ...p, totalClientes: clientesDoProjeto.length, piorRisco, saude: obterResumoSaudeProjeto(db, p.id) };
    })
    .filter((p) => (!filtroStatus || p.status === filtroStatus) && (!busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  function handleExcluir(e: React.MouseEvent, projetoId: string, nome: string) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Excluir o projeto "${nome}"? Isso remove TODOS os clientes, ciclos, respostas e histórico dele. Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    mutateDb((dbW) => excluirProjeto(dbW, projetoId));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Carteira de trabalho</p><h1>Projetos</h1><p className="mb-0 mt-2 text-sm text-neutral-500">Acompanhe clientes, ciclos e saúde de cada frente.</p></div>
        {isAdmin && (
          <Link href="/projetos/novo" className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md hover:bg-neutral-800">
            + Novo projeto
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-white p-3">
        <input aria-label="Buscar projeto" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto…" className="min-w-[220px] flex-1" />
        <select aria-label="Filtrar por status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="min-w-[170px]">
          <option value="">Todos os status</option><option value="ATIVO">Ativos</option><option value="PAUSADO">Pausados</option><option value="ENCERRADO">Encerrados</option>
        </select>
      </div>

      <div className="grid gap-3">
        {projetos.map((p) => (
          <Link key={p.id} href={`/projetos/detalhe?id=${p.id}`}>
            <Card className="project-list-card hover:border-neutral-400 transition flex items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="font-semibold text-neutral-900">{p.nome}</div>
                <div className="mt-1 text-sm text-neutral-500">{p.totalClientes} cliente{p.totalClientes === 1 ? "" : "s"} · {p.dataInicio ? `desde ${new Date(`${p.dataInicio}T12:00:00`).toLocaleDateString("pt-BR")}` : "sem data de início"}</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge status={p.status} />
                {p.saude.scoreSaudeGeral !== null && <span className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900">Saúde {p.saude.scoreSaudeGeral.toFixed(1)} / 10</span>}
                <RiscoBadge nivel={p.piorRisco} />
                {isAdmin && (
                  <button
                    onClick={(e) => handleExcluir(e, p.id, p.nome)}
                    className="text-xs text-red-600 underline hover:text-red-800"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </Card>
          </Link>
        ))}
        {projetos.length === 0 && <div className="empty-state"><span>◫</span><p>Nenhum projeto encontrado.</p><small>Ajuste a busca ou o filtro. Os projetos autorizados para este usuário aparecem nesta lista.</small></div>}
      </div>
    </div>
  );
}
