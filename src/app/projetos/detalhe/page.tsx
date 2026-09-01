"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth, podeAcessarProjeto } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId, excluirProjeto } from "@/lib/store";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";
import type { Periodicidade } from "@/lib/types";

const PERIODOS_EM_DIAS: Record<string, number> = {
  MENSAL: 30,
  TRIMESTRAL: 91,
  SEMESTRAL: 182,
  ANUAL: 365,
  PERSONALIZADO: 30,
};

export default function ProjetoDetalhePage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;

  const projeto = db.projetos.find((p) => p.id === id);
  if (!projeto) return <p className="text-sm text-neutral-500">Projeto não encontrado.</p>;
  if (!podeAcessarProjeto(user, id)) return <p className="text-sm text-neutral-500">Sem acesso a este projeto.</p>;

  const isAdmin = user.papel === "ADMIN";
  const cliente = db.clientes.find((c) => c.id === projeto.clienteId);
  const configuracaoCiclo = db.configuracoesCiclo.find((c) => c.projetoId === id);
  const csResponsavel = db.usuarios.find((u) => u.id === projeto.csResponsavelId);
  const acessos = db.acessosProjeto
    .filter((a) => a.projetoId === id)
    .map((a) => ({ ...a, usuario: db.usuarios.find((u) => u.id === a.usuarioId)! }))
    .filter((a) => a.usuario);
  const ciclos = db.ciclosAvaliacao
    .filter((c) => c.projetoId === id)
    .map((c) => ({ ...c, riscoChurn: db.riscosChurn.find((r) => r.cicloId === c.id) }))
    .sort((a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime());
  const indicadores = db.indicadoresDesempenho
    .filter((i) => i.projetoId === id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 10);
  const usuarios = isAdmin ? db.usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome)) : [];

  function handleConfigCiclo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const periodicidade = String(formData.get("periodicidade") ?? "MENSAL") as Periodicidade;
    const diaDisparo = Number(formData.get("diaDisparo") ?? 1);
    mutateDb((dbW) => {
      const cfg = dbW.configuracoesCiclo.find((c) => c.projetoId === id);
      if (cfg) {
        cfg.periodicidade = periodicidade;
        cfg.diaDisparo = diaDisparo;
      }
    });
  }

  function abrirNovoCiclo() {
    const dias = PERIODOS_EM_DIAS[configuracaoCiclo?.periodicidade ?? "MENSAL"];
    const dataInicio = new Date();
    const dataFim = new Date(dataInicio.getTime() + dias * 24 * 60 * 60 * 1000);
    const cicloId = novoId("ciclo");
    mutateDb((dbW) => {
      dbW.ciclosAvaliacao.push({
        id: cicloId,
        projetoId: id,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        status: "ABERTO",
        criadoEm: new Date().toISOString(),
      });
    });
    window.location.href = `/projetos/ciclo?projetoId=${id}&cicloId=${cicloId}`;
  }

  function handleIndicador(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const periodo = String(formData.get("periodo") ?? "").trim();
    const indiceEngajamento = String(formData.get("indiceEngajamento") ?? "").trim();
    const indiceAdocao = String(formData.get("indiceAdocao") ?? "").trim();
    const indiceMaturidade = String(formData.get("indiceMaturidade") ?? "").trim();
    if (!periodo) {
      alert("Período é obrigatório");
      return;
    }
    mutateDb((dbW) => {
      dbW.indicadoresDesempenho.push({
        id: novoId("indicador"),
        projetoId: id,
        periodo,
        indiceEngajamento: indiceEngajamento ? Number(indiceEngajamento) : null,
        indiceAdocao: indiceAdocao ? Number(indiceAdocao) : null,
        indiceMaturidade: indiceMaturidade ? Number(indiceMaturidade) : null,
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function concederAcesso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const usuarioId = String(formData.get("usuarioId") ?? "");
    if (!usuarioId) {
      alert("Selecione um usuário");
      return;
    }
    mutateDb((dbW) => {
      const existente = dbW.acessosProjeto.find((a) => a.usuarioId === usuarioId && a.projetoId === id);
      if (!existente) {
        dbW.acessosProjeto.push({ id: novoId("acesso"), usuarioId, projetoId: id, criadoEm: new Date().toISOString() });
      }
    });
    e.currentTarget.reset();
  }

  function revogarAcesso(usuarioId: string) {
    mutateDb((dbW) => {
      dbW.acessosProjeto = dbW.acessosProjeto.filter((a) => !(a.usuarioId === usuarioId && a.projetoId === id));
    });
  }

  function handleExcluir() {
    if (
      !window.confirm(
        `Excluir o projeto "${projeto!.nome}"? Isso remove todos os ciclos, respostas e histórico dele. Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    mutateDb((dbW) => excluirProjeto(dbW, id));
    router.push("/projetos");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{projeto.nome}</h1>
          <p className="text-sm text-neutral-500">
            {cliente && (
              <Link href={`/clientes/detalhe?id=${cliente.id}`} className="underline hover:text-neutral-900">
                {cliente.nome}
              </Link>
            )}
            {csResponsavel && ` · CS: ${csResponsavel.nome}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={projeto.status} />
          {isAdmin && (
            <button onClick={handleExcluir} className="text-sm text-red-600 underline hover:text-red-800">
              Excluir projeto
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Ciclo de avaliação</h2>
          {isAdmin ? (
            <form onSubmit={handleConfigCiclo} className="flex flex-wrap items-end gap-2 mb-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Periodicidade</label>
                <select name="periodicidade" defaultValue={configuracaoCiclo?.periodicidade} className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
                  <option value="MENSAL">Mensal</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="ANUAL">Anual</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Dia de disparo</label>
                <input type="number" name="diaDisparo" min={1} max={28} defaultValue={configuracaoCiclo?.diaDisparo} className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <button className="text-sm underline text-neutral-600 hover:text-neutral-900 pb-1.5">Salvar</button>
            </form>
          ) : (
            <p className="text-sm text-neutral-500 mb-4">Periodicidade: {configuracaoCiclo?.periodicidade}</p>
          )}

          <button onClick={abrirNovoCiclo} className="bg-neutral-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-neutral-800">
            + Abrir novo ciclo agora
          </button>

          <div className="mt-4 space-y-2">
            {ciclos.map((c) => (
              <Link key={c.id} href={`/projetos/ciclo?projetoId=${id}&cicloId=${c.id}`} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 hover:border-neutral-400">
                <div className="text-sm text-neutral-800">
                  {format(new Date(c.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                  {c.dataFim && ` – ${format(new Date(c.dataFim), "dd/MM/yyyy", { locale: ptBR })}`}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  <RiscoBadge nivel={c.riscoChurn?.nivelRisco} />
                </div>
              </Link>
            ))}
            {ciclos.length === 0 && <p className="text-sm text-neutral-500">Nenhum ciclo aberto ainda.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Indicadores de desempenho</h2>
          <form onSubmit={handleIndicador} className="grid grid-cols-2 gap-2 mb-4">
            <input name="periodo" placeholder="Período (ex: 2026-07)" required className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input type="number" step="0.1" name="indiceEngajamento" placeholder="Engajamento (0-100)" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input type="number" step="0.1" name="indiceAdocao" placeholder="Adoção (0-100)" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input type="number" step="0.1" name="indiceMaturidade" placeholder="Maturidade (0-100)" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <button className="bg-neutral-900 text-white rounded-md py-1.5 text-sm hover:bg-neutral-800">+ Adicionar</button>
          </form>
          <div className="space-y-1">
            {indicadores.map((i) => (
              <div key={i.id} className="text-sm text-neutral-700 flex justify-between">
                <span>{i.periodo}</span>
                <span className="text-neutral-500">
                  Eng: {i.indiceEngajamento ?? "—"} · Adoção: {i.indiceAdocao ?? "—"} · Maturidade: {i.indiceMaturidade ?? "—"}
                </span>
              </div>
            ))}
            {indicadores.length === 0 && <p className="text-sm text-neutral-500">Nenhum indicador registrado ainda.</p>}
          </div>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Acesso ao projeto (usuários padrão)</h2>
          <div className="space-y-2 mb-4">
            {acessos.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                <span className="text-sm text-neutral-800">
                  {a.usuario.nome} ({a.usuario.papel})
                </span>
                <button onClick={() => revogarAcesso(a.usuarioId)} className="text-xs text-red-600 underline">
                  Revogar
                </button>
              </div>
            ))}
            {acessos.length === 0 && <p className="text-sm text-neutral-500">Nenhum usuário com acesso direto ainda.</p>}
          </div>
          <form onSubmit={concederAcesso} className="flex gap-2">
            <select name="usuarioId" className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="">
              <option value="">Selecione um usuário...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.papel})
                </option>
              ))}
            </select>
            <button className="bg-neutral-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-neutral-800">Conceder</button>
          </form>
        </Card>
      )}
    </div>
  );
}
