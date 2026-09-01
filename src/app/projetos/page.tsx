"use client";

import Link from "next/link";
import { useAuth, getProjetoIdsDoUsuario } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, excluirProjeto } from "@/lib/store";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";

export default function ProjetosPage() {
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;

  const isAdmin = user.papel === "ADMIN";
  const projetoIds = isAdmin ? null : getProjetoIdsDoUsuario(user.id);

  const projetos = db.projetos
    .filter((p) => (isAdmin ? true : projetoIds?.includes(p.id)))
    .map((p) => ({
      ...p,
      cliente: db.clientes.find((c) => c.id === p.clienteId)!,
      riscoChurn: db.riscosChurn
        .filter((r) => r.projetoId === p.id)
        .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0],
    }))
    .filter((p) => p.cliente && p.cliente.status !== "INATIVO")
    .sort((a, b) => a.nome.localeCompare(b.nome));

  function handleExcluir(e: React.MouseEvent, projetoId: string, nome: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Excluir o projeto "${nome}"? Isso remove todos os ciclos, respostas e histórico dele. Essa ação não pode ser desfeita.`)) {
      return;
    }
    mutateDb((dbW) => excluirProjeto(dbW, projetoId));
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Projetos</h1>
        {isAdmin && (
          <Link href="/projetos/novo" className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md hover:bg-neutral-800">
            + Novo projeto
          </Link>
        )}
      </div>

      <div className="grid gap-3">
        {projetos.map((p) => (
          <Link key={p.id} href={`/projetos/detalhe?id=${p.id}`}>
            <Card className="hover:border-neutral-400 transition flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-900">{p.nome}</div>
                <div className="text-sm text-neutral-500">{p.cliente.nome}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                <RiscoBadge nivel={p.riscoChurn?.nivelRisco} />
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
        {projetos.length === 0 && <p className="text-sm text-neutral-500">Nenhum projeto disponível para você ainda.</p>}
      </div>
    </div>
  );
}
