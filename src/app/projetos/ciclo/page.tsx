"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth, podeAcessarProjeto } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";

export default function CicloRosterPage() {
  const searchParams = useSearchParams();
  const projetoId = searchParams.get("projetoId") ?? "";
  const cicloId = searchParams.get("cicloId") ?? "";
  const { user, pronto } = useAuth();
  const db = useDb();
  const [busca, setBusca] = useState("");

  if (!pronto || !db || !user) return null;
  if (!podeAcessarProjeto(user, projetoId)) return <p className="text-sm text-neutral-500">Sem acesso a este projeto.</p>;

  const ciclo = db.ciclosAvaliacao.find((c) => c.id === cicloId && c.projetoId === projetoId);
  if (!ciclo) return <p className="text-sm text-neutral-500">Ciclo não encontrado.</p>;
  const projeto = db.projetos.find((p) => p.id === projetoId)!;

  const termoBusca = busca.trim().toLowerCase();
  const clientes = db.clientes
    .filter((c) => c.projetoId === projetoId)
    .filter((c) => (termoBusca ? c.nome.toLowerCase().includes(termoBusca) : true))
    .map((c) => ({
      ...c,
      risco: db.riscosChurn.find((r) => r.cicloId === cicloId && r.clienteId === c.id),
      totalRespostas:
        db.respostasAtivas.filter((r) => r.cicloId === cicloId && db.contatosCliente.find((ct) => ct.id === r.contatoClienteId)?.clienteId === c.id).length +
        db.respostasPassivas.filter((r) => r.cicloId === cicloId && r.clienteId === c.id).length,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {projeto.nome} · Ciclo {format(new Date(ciclo.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
          {ciclo.dataFim && ` – ${format(new Date(ciclo.dataFim), "dd/MM/yyyy", { locale: ptBR })}`}
        </h1>
        <p className="text-sm text-neutral-500">Status: {ciclo.status} · clique num cliente para responder ou calcular o risco dele</p>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente por nome..."
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="grid gap-2">
        {clientes.map((c) => (
          <Link key={c.id} href={`/projetos/ciclo/cliente?projetoId=${projetoId}&cicloId=${cicloId}&clienteId=${c.id}`}>
            <Card className="hover:border-neutral-400 transition flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-900">{c.nome}</div>
                <div className="text-sm text-neutral-500">
                  {c.totalRespostas > 0 ? `${c.totalRespostas} resposta(s) registrada(s)` : "Sem respostas ainda"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={c.status} />
                <RiscoBadge nivel={c.risco?.nivelRisco} />
              </div>
            </Card>
          </Link>
        ))}
        {clientes.length === 0 && <p className="text-sm text-neutral-500">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}
