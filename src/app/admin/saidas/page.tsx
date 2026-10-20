"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth, getProjetoIdsDoUsuario, isAdminGeral } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, excluirFormularioSaida } from "@/lib/store";
import { Card } from "@/components/ui";
import { statusPorScoreSaude } from "@/lib/churn";

const MOTIVO_LABEL: Record<string, string> = {
  PRECO: "Preço",
  RESULTADOS_INSATISFATORIOS: "Resultados insatisfatórios",
  ATENDIMENTO_COMUNICACAO: "Atendimento/comunicação",
  CORTE_ORCAMENTO_CLIENTE: "Corte de orçamento do cliente",
  MUDANCA_ESTRATEGIA_CLIENTE: "Mudança de estratégia do cliente",
  ENCERRAMENTO_EMPRESA_CLIENTE: "Encerramento da empresa do cliente",
  CONCORRENCIA: "Foi para a concorrência",
  PROBLEMAS_INTERNOS_AGENCIA: "Problemas internos da agência",
  OUTRO: "Outro",
};

export default function MotivosSaidaPage() {
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  const projetosPermitidos = isAdminGeral(user) ? null : new Set(getProjetoIdsDoUsuario(user.id));
  const saidas = db.formulariosSaida
    .slice()
    .sort((a, b) => new Date(b.dataSaida).getTime() - new Date(a.dataSaida).getTime())
    .map((s) => ({
      ...s,
      cliente: db.clientes.find((c) => c.id === s.clienteId),
      responsavel: db.usuarios.find((u) => u.id === s.responsavelId),
    }))
    .filter((s) => s.cliente && (!projetosPermitidos || projetosPermitidos.has(s.cliente.projetoId)));

  const contagemPorMotivo = new Map<string, number>();
  let evitaveis = 0;
  for (const s of saidas) {
    contagemPorMotivo.set(s.motivoPrincipal, (contagemPorMotivo.get(s.motivoPrincipal) ?? 0) + 1);
    if (s.poderiaSerEvitado) evitaveis++;
  }
  const motivosOrdenados = Array.from(contagemPorMotivo.entries()).sort((a, b) => b[1] - a[1]);
  const maiorContagem = motivosOrdenados[0]?.[1] ?? 1;

  function handleExcluir(formularioId: string, clienteId: string, clienteNome?: string) {
    const cliente = db!.clientes.find((c) => c.id === clienteId);
    if (!cliente || (projetosPermitidos && !projetosPermitidos.has(cliente.projetoId))) return;
    if (
      !window.confirm(
        `Excluir o registro de saída de "${clienteNome ?? "cliente"}"? Isso reativa o cliente (volta a aparecer normalmente no sistema). Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    mutateDb((dbW) => {
      excluirFormularioSaida(dbW, formularioId);
      const aindaTemOutraSaida = dbW.formulariosSaida.some((f) => f.clienteId === clienteId);
      if (!aindaTemOutraSaida) {
        const c = dbW.clientes.find((cl) => cl.id === clienteId);
        if (c && c.status === "INATIVO") {
          const ultimaSaude = dbW.riscosChurn
            .filter((risco) => risco.clienteId === clienteId)
            .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0];
          c.status = statusPorScoreSaude(ultimaSaude?.scoreSaudeGeral);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Relatórios</p>
        <h1>Motivos de saída</h1>
        <p className="mb-0 mt-2 text-sm text-neutral-500">
          {saidas.length} cliente(s) encerrado(s) · {evitaveis} marcado(s) como evitável(is)
        </p>
      </div>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-4">Distribuição por motivo principal</h2>
        {motivosOrdenados.length > 0 ? (
          <div className="space-y-2">
            {motivosOrdenados.map(([motivo, count]) => (
              <div key={motivo} className="flex items-center gap-3">
                <span className="w-56 shrink-0 text-sm text-neutral-700">{MOTIVO_LABEL[motivo] ?? motivo}</span>
                <div className="flex-1 bg-neutral-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-red-400 h-3 rounded-full" style={{ width: `${(count / maiorContagem) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-sm font-medium text-neutral-800">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Nenhum cliente encerrado até agora.</p>
        )}
      </Card>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-3">Histórico de saídas</h2>
        <div className="space-y-3">
          {saidas.map((s) => (
            <div key={s.id} className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <Link href={`/clientes/detalhe?id=${s.clienteId}`} className="text-sm font-medium text-neutral-900 hover:underline">
                  {s.cliente?.nome}
                </Link>
                <span className="text-xs text-neutral-400">{format(new Date(s.dataSaida), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <p className="text-sm text-neutral-600">
                {MOTIVO_LABEL[s.motivoPrincipal] ?? s.motivoPrincipal}
                {s.poderiaSerEvitado && <span className="ml-2 text-xs text-red-600 font-medium">EVITÁVEL</span>}
              </p>
              <p className="text-sm text-neutral-500">{s.detalhamento}</p>
              <p className="text-xs text-neutral-400 mt-1 flex items-center justify-between">
                <span>Registrado por {s.responsavel?.nome}</span>
                <button
                  onClick={() => handleExcluir(s.id, s.clienteId, s.cliente?.nome)}
                  className="inline-action inline-action-danger"
                >
                  Excluir registro
                </button>
              </p>
            </div>
          ))}
          {saidas.length === 0 && <p className="text-sm text-neutral-500">Nenhum registro ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
