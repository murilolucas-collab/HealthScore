"use client";

import Link from "next/link";
import { useAuth, getProjetoIdsDoUsuario } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { Card, StatusBadge, RiscoBadge, CategoriaLabel } from "@/components/ui";
import type { NivelRisco } from "@/lib/types";

const ORDEM_RISCO: NivelRisco[] = ["CRITICO", "ALTO", "MEDIO", "BAIXO"];

function corBarra(mediaNota: number) {
  if (mediaNota >= 8) return "bg-emerald-400";
  if (mediaNota >= 6) return "bg-amber-400";
  return "bg-red-400";
}

export default function Home() {
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;

  const isAdmin = user.papel === "ADMIN";
  const projetoIds = isAdmin ? null : getProjetoIdsDoUsuario(user.id);

  const projetosVisiveis = db.projetos.filter((p) => (isAdmin ? true : projetoIds?.includes(p.id)));
  const projetoIdsVisiveis = new Set(projetosVisiveis.map((p) => p.id));

  const clientes = db.clientes
    .filter((c) => projetoIdsVisiveis.has(c.projetoId) && c.status !== "INATIVO")
    .map((c) => ({
      ...c,
      projeto: db.projetos.find((p) => p.id === c.projetoId),
      riscoChurn: db.riscosChurn
        .filter((r) => r.clienteId === c.id)
        .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0],
    }));

  const contagemPorNivel: Record<string, number> = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 };
  for (const c of clientes) {
    const nivel = c.riscoChurn?.nivelRisco;
    if (nivel) contagemPorNivel[nivel]++;
  }

  const pesoOrdem: Record<string, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAIXO: 3 };
  const clientesEmDestaque = clientes
    .filter((c) => c.riscoChurn)
    .sort((a, b) => (pesoOrdem[a.riscoChurn!.nivelRisco] ?? 9) - (pesoOrdem[b.riscoChurn!.nivelRisco] ?? 9))
    .slice(0, 10);

  const projetosComResumo = projetosVisiveis
    .map((p) => {
      const clientesDoProjeto = clientes.filter((c) => c.projetoId === p.id);
      const contagem: Record<string, number> = { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 };
      for (const c of clientesDoProjeto) {
        const nivel = c.riscoChurn?.nivelRisco;
        if (nivel) contagem[nivel]++;
      }
      return {
        ...p,
        csResponsavel: db.usuarios.find((u) => u.id === p.csResponsavelId) ?? null,
        totalClientes: clientesDoProjeto.length,
        contagem,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const porCS = new Map<string, { nome: string; totalClientes: number; contagem: Record<string, number> }>();
  if (isAdmin) {
    for (const p of projetosComResumo) {
      const chave = p.csResponsavelId ?? "sem-cs";
      const nome = p.csResponsavel?.nome ?? "Sem CS responsável";
      const entry = porCS.get(chave) ?? { nome, totalClientes: 0, contagem: { CRITICO: 0, ALTO: 0, MEDIO: 0, BAIXO: 0 } };
      entry.totalClientes += p.totalClientes;
      for (const nivel of ORDEM_RISCO) entry.contagem[nivel] += p.contagem[nivel];
      porCS.set(chave, entry);
    }
  }

  const cicloClientePares = new Set(
    clientes.filter((c) => c.riscoChurn).map((c) => `${c.riscoChurn!.cicloId}::${c.id}`)
  );
  const pontuacoes = db.pontuacoesCategoria.filter((p) => cicloClientePares.has(`${p.cicloId}::${p.clienteId}`));

  function mediaPorCategoria(polo: "ATIVO" | "PASSIVO") {
    const grupos = new Map<string, number[]>();
    for (const p of pontuacoes.filter((p) => p.polo === polo)) {
      grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p.mediaNota]);
    }
    return Array.from(grupos.entries())
      .map(([categoria, notas]) => ({
        categoria,
        media: notas.reduce((a, b) => a + b, 0) / notas.length,
      }))
      .sort((a, b) => a.media - b.media);
  }

  const categoriasAtivas = mediaPorCategoria("ATIVO");
  const categoriasPassivas = mediaPorCategoria("PASSIVO");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">
        Dashboard {isAdmin ? "geral" : "dos meus projetos"}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ORDEM_RISCO.map((nivel) => (
          <Card key={nivel} className="text-center">
            <div className="text-2xl font-semibold text-neutral-900">{contagemPorNivel[nivel]}</div>
            <RiscoBadge nivel={nivel} />
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-neutral-900">Clientes em maior risco</h2>
            {isAdmin && (
              <Link href="/clientes" className="text-xs underline text-neutral-500 hover:text-neutral-900">
                ver todos
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {clientesEmDestaque.map((c) => (
              <Link
                key={c.id}
                href={isAdmin ? `/clientes/detalhe?id=${c.id}` : "#"}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 hover:border-neutral-400"
              >
                <div>
                  <div className="text-sm text-neutral-800">{c.nome}</div>
                  <div className="text-xs text-neutral-500">{c.projeto?.nome ?? "—"}</div>
                </div>
                <RiscoBadge nivel={c.riscoChurn?.nivelRisco} />
              </Link>
            ))}
            {clientesEmDestaque.length === 0 && (
              <p className="text-sm text-neutral-500">Nenhum risco calculado ainda.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-neutral-900">Risco por projeto</h2>
            <Link href="/projetos" className="text-xs underline text-neutral-500 hover:text-neutral-900">
              ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {projetosComResumo.map((p) => (
              <Link
                key={p.id}
                href={`/projetos/detalhe?id=${p.id}`}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 hover:border-neutral-400"
              >
                <div>
                  <div className="text-sm text-neutral-800">{p.nome}</div>
                  <div className="text-xs text-neutral-500">{p.totalClientes} cliente(s) ativo(s)</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {ORDEM_RISCO.filter((n) => p.contagem[n] > 0).map((n) => (
                    <span key={n} className="text-xs text-neutral-500">
                      {p.contagem[n]} <RiscoBadge nivel={n} />
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            {projetosComResumo.length === 0 && <p className="text-sm text-neutral-500">Nenhum projeto disponível.</p>}
          </div>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Risco por CS (responsável)</h2>
          <div className="space-y-2">
            {Array.from(porCS.values())
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map(({ nome, totalClientes, contagem }) => (
                <div key={nome} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                  <div>
                    <div className="text-sm text-neutral-800">{nome}</div>
                    <div className="text-xs text-neutral-500">{totalClientes} cliente(s)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ORDEM_RISCO.filter((n) => contagem[n] > 0).map((n) => (
                      <span key={n} className="text-xs text-neutral-500">
                        {contagem[n]} <RiscoBadge nivel={n} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            {porCS.size === 0 && <p className="text-sm text-neutral-500">Nenhum cliente com risco calculado ainda.</p>}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium text-neutral-900 mb-1">Nota média por categoria (NPS)</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Média do último ciclo calculado de cada cliente — atendimento, arte e tráfego.
          </p>
          {categoriasAtivas.length > 0 ? (
            <div className="space-y-2">
              {categoriasAtivas.map(({ categoria, media }) => (
                <div key={categoria} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-neutral-700">
                    <CategoriaLabel polo="ATIVO" categoria={categoria} />
                  </span>
                  <div className="flex-1 bg-neutral-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full ${corBarra(media)}`} style={{ width: `${(media / 10) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-neutral-800">{media.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Nenhum ciclo calculado ainda.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-medium text-neutral-900 mb-1">Onde o time tem mais falhas</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Pilares do polo passivo ordenados do pior para o melhor — vermelho/âmbar indicam alerta.
          </p>
          {categoriasPassivas.length > 0 ? (
            <div className="space-y-2">
              {categoriasPassivas.map(({ categoria, media }) => (
                <div key={categoria} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm text-neutral-700">
                    <CategoriaLabel polo="PASSIVO" categoria={categoria} />
                  </span>
                  <div className="flex-1 bg-neutral-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full ${corBarra(media)}`} style={{ width: `${(media / 10) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-neutral-800">{media.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Nenhum ciclo calculado ainda.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
