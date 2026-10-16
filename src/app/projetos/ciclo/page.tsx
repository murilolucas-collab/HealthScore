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
  const comResposta = clientes.filter((cliente) => cliente.totalRespostas > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
        <Link href={`/projetos/detalhe?id=${projetoId}`} className="hover:text-neutral-900 hover:underline">{projeto.nome}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-neutral-900">Ciclo</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Operação · avaliações</p>
          <h1>{projeto.nome} · ciclo</h1>
          <p className="mb-0 mt-2 text-sm text-neutral-500">{format(new Date(ciclo.dataInicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}{ciclo.dataFim && ` — até ${format(new Date(ciclo.dataFim), "dd/MM/yyyy", { locale: ptBR })}`}</p>
        </div>
        <StatusBadge status={ciclo.status} />
      </div>

      <Card className="cycle-progress-card">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-2xl">{comResposta}<span className="text-sm font-medium text-neutral-400"> / {clientes.length}</span></strong><p className="mb-0 mt-1 text-xs text-neutral-500">clientes com respostas registradas</p></div><div className="w-full max-w-md"><div className="mb-2 flex justify-between text-xs text-neutral-500"><span>Progresso do ciclo</span><span>{clientes.length ? Math.round(comResposta / clientes.length * 100) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${clientes.length ? comResposta / clientes.length * 100 : 0}%` }} /></div></div></div>
      </Card>

      <div><h2 className="mb-3 text-sm font-semibold">Clientes deste ciclo</h2>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente por nome..."
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="mt-3 grid gap-2">
        {clientes.map((c) => (
          <Link key={c.id} href={`/projetos/ciclo/cliente?projetoId=${projetoId}&cicloId=${cicloId}&clienteId=${c.id}`}>
            <Card className="cycle-client-row hover:border-neutral-400 transition flex items-center justify-between gap-4">
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
    </div>
  );
}
