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
    .filter((c) => (!projetosPermitidos || projetosPermitidos.has(c.projetoId)) && (filtroProjeto ? c.projetoId === filtroProjeto : true))
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">
          Clientes <span className="text-sm font-normal text-neutral-400">({clientes.length})</span>
        </h1>
        {podeGerenciar && <Link href="/clientes/novo" className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md hover:bg-neutral-800">+ Novo cliente</Link>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="flex-1 min-w-[200px] rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={filtroProjeto}
          onChange={(e) => setFiltroProjeto(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os projetos</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3">
        {clientes.map(({ cliente, projeto, risco }) => (
          <Card key={cliente.id} className="hover:border-neutral-400 transition flex items-center justify-between">
            <Link href={`/clientes/detalhe?id=${cliente.id}`} className="flex-1 min-w-0">
              <div className="font-medium text-neutral-900">{cliente.nome}</div>
              <div className="text-sm text-neutral-500">
                {projeto?.nome ?? "Sem projeto"} · {cliente.segmento ?? "Sem segmento"}
              </div>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={cliente.status} />
              <RiscoBadge nivel={risco?.nivelRisco} />
              {podeGerenciar && <button onClick={() => handleExcluir(cliente.id, cliente.nome)} className="text-xs text-red-600 underline hover:text-red-800">Excluir</button>}
            </div>
          </Card>
        ))}
        {clientes.length === 0 && <p className="text-sm text-neutral-500">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}
