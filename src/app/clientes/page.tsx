"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";

const ORDEM = ["CRITICO", "ALTO", "MEDIO", "BAIXO"];

export default function ClientesPage() {
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  const clientes = db.clientes
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((cliente) => {
      const projetos = db.projetos.filter((p) => p.clienteId === cliente.id);
      const piorRisco = projetos
        .map((p) => {
          const risco = db.riscosChurn
            .filter((r) => r.projetoId === p.id)
            .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0];
          return risco?.nivelRisco;
        })
        .filter(Boolean);
      const destaque = ORDEM.find((n) => piorRisco.includes(n as never));
      return { cliente, projetosCount: projetos.length, destaque };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Clientes</h1>
        <Link href="/clientes/novo" className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md hover:bg-neutral-800">
          + Novo cliente
        </Link>
      </div>

      <div className="grid gap-3">
        {clientes.map(({ cliente, projetosCount, destaque }) => (
          <Link key={cliente.id} href={`/clientes/detalhe?id=${cliente.id}`}>
            <Card className="hover:border-neutral-400 transition flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-900">{cliente.nome}</div>
                <div className="text-sm text-neutral-500">
                  {cliente.segmento ?? "Sem segmento"} · {projetosCount} projeto(s)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={cliente.status} />
                <RiscoBadge nivel={destaque} />
              </div>
            </Card>
          </Link>
        ))}
        {clientes.length === 0 && <p className="text-sm text-neutral-500">Nenhum cliente cadastrado ainda.</p>}
      </div>
    </div>
  );
}
