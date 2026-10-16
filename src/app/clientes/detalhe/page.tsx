"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth, podeAcessarProjeto, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { getDb, mutateDb, novoId, excluirCliente } from "@/lib/store";
import { salvarDbRemoto } from "@/lib/github-sync";
import { Card, StatusBadge, RiscoBadge } from "@/components/ui";
import type { TipoEvento, StatusCliente } from "@/lib/types";

const TIPO_EVENTO_LABEL: Record<string, string> = {
  RECLAMACAO: "Reclamação",
  INTERVENCAO: "Intervenção",
  ACAO_CS: "Ação de CS",
  ELOGIO: "Elogio",
  MUDANCA_ESCOPO: "Mudança de escopo",
  OUTRO: "Outro",
};

const MOTIVO_SAIDA_LABEL: Record<string, string> = {
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

export default function ClienteDetalhePage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { user, pronto } = useAuth();
  const db = useDb();
  const [statusSalvo, setStatusSalvo] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState("");

  if (!pronto || !db || !user) return null;
  if (!temPermissao(user, "verClientes")) return <p className="text-sm text-neutral-500">Você não tem permissão para visualizar clientes.</p>;

  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) return <p className="text-sm text-neutral-500">Cliente não encontrado.</p>;

  const contatos = db.contatosCliente.filter((c) => c.clienteId === id);
  const perfilRisco = db.perfisRisco.find((p) => p.clienteId === id);
  const projeto = db.projetos.find((p) => p.id === cliente.projetoId);
  if (user.papel !== "ADMIN" && !podeAcessarProjeto(user, cliente.projetoId)) {
    return <p className="text-sm text-neutral-500">Você não tem acesso ao projeto deste cliente.</p>;
  }
  const podeGerenciar = temPermissao(user, "gerenciarClientes");
  const podeAlterarStatus = temPermissao(user, "alterarStatusCliente");
  const riscoAtual = db.riscosChurn
    .filter((r) => r.clienteId === id)
    .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())[0];
  const eventos = db.eventosCliente
    .filter((e) => e.clienteId === id)
    .sort((a, b) => new Date(b.dataOcorrencia).getTime() - new Date(a.dataOcorrencia).getTime())
    .slice(0, 20);
  const metas = db.metasCliente.filter((m) => m.clienteId === id && m.ativa).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const formularioSaida = db.formulariosSaida
    .filter((f) => f.clienteId === id)
    .sort((a, b) => new Date(b.dataSaida).getTime() - new Date(a.dataSaida).getTime())[0];
  const responsavelSaida = formularioSaida ? db.usuarios.find((u) => u.id === formularioSaida.responsavelId) : null;

  function handleContato(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeGerenciar) return;
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const cargo = String(formData.get("cargo") ?? "").trim() || null;
    if (!nome || !email) {
      alert("Nome e email do contato são obrigatórios");
      return;
    }
    mutateDb((dbW) => {
      dbW.contatosCliente.push({
        id: novoId("contato"),
        clienteId: id,
        nome,
        email,
        cargo,
        telefone: null,
        principal: false,
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function handleEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeGerenciar) return;
    const formData = new FormData(e.currentTarget);
    const tipo = String(formData.get("tipo") ?? "OUTRO") as TipoEvento;
    const descricao = String(formData.get("descricao") ?? "").trim();
    if (!descricao) {
      alert("Descrição do evento é obrigatória");
      return;
    }
    mutateDb((dbW) => {
      dbW.eventosCliente.push({
        id: novoId("evento"),
        clienteId: id,
        projetoId: cliente!.projetoId,
        tipo,
        descricao,
        autorId: user!.id,
        dataOcorrencia: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function handleMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeGerenciar) return;
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get("nome") ?? "").trim();
    const valorAlvoStr = String(formData.get("valorAlvo") ?? "").trim();
    const unidade = String(formData.get("unidade") ?? "").trim() || null;
    if (!nome || !valorAlvoStr) {
      alert("Nome e valor alvo da meta são obrigatórios");
      return;
    }
    mutateDb((dbW) => {
      dbW.metasCliente.push({
        id: novoId("meta"),
        clienteId: id,
        nome,
        valorAlvo: Number(valorAlvoStr),
        unidade,
        ativa: true,
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function encerrarMeta(metaId: string) {
    if (!podeGerenciar) return;
    mutateDb((dbW) => {
      const meta = dbW.metasCliente.find((m) => m.id === metaId);
      if (meta) meta.ativa = false;
    });
  }

  async function handleStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeAlterarStatus || salvandoStatus) return;
    const formData = new FormData(e.currentTarget);
    const status = String(formData.get("status") ?? "ATIVO") as StatusCliente;
    setSalvandoStatus(true);
    setStatusSalvo(false);
    setErroStatus("");
    mutateDb((dbW) => {
      const c = dbW.clientes.find((cl) => cl.id === id);
      if (c) c.status = status;
    });
    try {
      const resultado = await salvarDbRemoto(getDb());
      if (!resultado.ok) {
        setErroStatus(`O status foi alterado neste navegador, mas não foi possível salvar no servidor: ${resultado.erro}`);
        return;
      }
      setStatusSalvo(true);
    } catch {
      setErroStatus("O status foi alterado neste navegador, mas não foi possível salvar no servidor. Tente novamente.");
    } finally {
      setSalvandoStatus(false);
    }
  }

  function handleExcluir() {
    if (!podeGerenciar) return;
    if (
      !window.confirm(
        `Excluir "${cliente!.nome}" definitivamente? Isso apaga também todos os projetos, ciclos, respostas e histórico desse cliente. Não pode ser desfeito.`
      )
    ) {
      return;
    }
    mutateDb((dbW) => excluirCliente(dbW, id));
    router.push("/clientes");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/clientes" className="hover:text-neutral-900 hover:underline">Clientes</Link>
        <span aria-hidden="true">/</span>
        {projeto && <><Link href={`/projetos/detalhe?id=${projeto.id}`} className="hover:text-neutral-900 hover:underline">{projeto.nome}</Link><span aria-hidden="true">/</span></>}
        <span className="text-neutral-900">{cliente.nome}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{cliente.nome}</h1>
          <p className="text-sm text-neutral-500">
            {cliente.segmento ?? "Sem segmento"}
            {cliente.cnpj && ` · CNPJ ${cliente.cnpj}`}
            {cliente.inicioContrato &&
              ` · cliente desde ${format(new Date(cliente.inicioContrato), "MMM/yyyy", { locale: ptBR })}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={cliente.status} />
          {perfilRisco && (
            <span className="text-xs text-neutral-500">
              Propensão a risco: {perfilRisco.propensaoRisco.toFixed(0)} · {perfilRisco.tendencia}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {cliente.status !== "INATIVO" ? (
          <>
            {podeAlterarStatus ? <form onSubmit={handleStatus} className="flex items-center gap-2">
              <label className="text-sm text-neutral-600">Status do cliente:</label>
              <select name="status" value={cliente.status} onChange={() => { setStatusSalvo(false); setErroStatus(""); }} disabled={salvandoStatus} className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60">
                <option value="ATIVO">Ativo</option>
                <option value="EM_RISCO">Em risco</option>
              </select>
              <button disabled={salvandoStatus} className="text-sm underline text-neutral-600 hover:text-neutral-900 disabled:opacity-60">{salvandoStatus ? "Salvando…" : "Salvar"}</button>
              {statusSalvo && <span role="status" className="text-xs text-emerald-700">Status salvo</span>}
              {erroStatus && <span role="alert" className="text-xs text-red-700">{erroStatus}</span>}
            </form> : <span className="text-sm text-neutral-500">Status do cliente: {cliente.status === "EM_RISCO" ? "Em risco" : "Ativo"}</span>}
            {podeGerenciar && <Link href={`/clientes/saida?id=${cliente.id}`} className="text-sm text-red-600 underline hover:text-red-800">Encerrar cliente (registrar saída)</Link>}
          </>
        ) : (
          <span className="text-sm text-neutral-500">Cliente encerrado — veja o formulário de saída abaixo.</span>
        )}
        {podeGerenciar && <button onClick={handleExcluir} className="text-sm text-red-600 underline hover:text-red-800 ml-auto">Excluir cliente definitivamente</button>}
      </div>

      {formularioSaida && responsavelSaida && (
        <Card className="border-red-200">
          <h2 className="font-medium text-neutral-900 mb-3">Formulário de saída</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-neutral-500">Motivo principal</div>
              <div className="font-medium text-neutral-800">{MOTIVO_SAIDA_LABEL[formularioSaida.motivoPrincipal]}</div>
            </div>
            <div>
              <div className="text-neutral-500">Poderia ser evitado?</div>
              <div className="font-medium text-neutral-800">{formularioSaida.poderiaSerEvitado ? "Sim" : "Não"}</div>
            </div>
            <div>
              <div className="text-neutral-500">Registrado por</div>
              <div className="font-medium text-neutral-800">
                {responsavelSaida.nome} em {format(new Date(formularioSaida.dataSaida), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
            {formularioSaida.notaSatisfacaoGeral !== null && (
              <div>
                <div className="text-neutral-500">Satisfação geral retrospectiva</div>
                <div className="font-medium text-neutral-800">{formularioSaida.notaSatisfacaoGeral}/10</div>
              </div>
            )}
            <div className="md:col-span-2">
              <div className="text-neutral-500">Detalhamento</div>
              <div className="text-neutral-800">{formularioSaida.detalhamento}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Projeto</h2>
          {projeto ? (
            <Link href={`/projetos/detalhe?id=${projeto.id}`} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 hover:border-neutral-400">
              <span className="text-sm text-neutral-800">{projeto.nome}</span>
              <RiscoBadge nivel={riscoAtual?.nivelRisco} />
            </Link>
          ) : (
            <p className="text-sm text-neutral-500">Projeto não encontrado.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-medium text-neutral-900 mb-3">Contatos</h2>
          <div className="space-y-2 mb-4">
            {contatos.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                <div>
                  <div className="text-sm text-neutral-800">
                    {c.nome} {c.principal && <span className="text-xs text-neutral-400">(principal)</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.cargo ?? "—"} · {c.email}
                  </div>
                </div>
              </div>
            ))}
            {contatos.length === 0 && <p className="text-sm text-neutral-500">Nenhum contato cadastrado.</p>}
          </div>
          {podeGerenciar && <form onSubmit={handleContato} className="grid grid-cols-2 gap-2">
            <input name="nome" placeholder="Nome" required className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input name="cargo" placeholder="Cargo" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <button className="col-span-2 bg-neutral-900 text-white rounded-md py-1.5 text-sm hover:bg-neutral-800">+ Adicionar contato</button>
          </form>}
        </Card>
      </div>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-1">Metas acordadas</h2>
        <p className="text-xs text-neutral-500 mb-3">
          A cada ciclo a equipe registra o valor entregue de cada meta, alimentando o pilar &quot;Meta atingida&quot; do health score.
        </p>
        <div className="space-y-2 mb-4">
          {metas.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
              <span className="text-sm text-neutral-800">
                {m.nome}: {m.valorAlvo}
                {m.unidade ? ` ${m.unidade}` : ""}
              </span>
              <button onClick={() => encerrarMeta(m.id)} className="text-xs text-neutral-400 underline hover:text-neutral-700">
                Encerrar meta
              </button>
            </div>
          ))}
          {metas.length === 0 && <p className="text-sm text-neutral-500">Nenhuma meta cadastrada ainda.</p>}
        </div>
        {podeGerenciar && <form onSubmit={handleMeta} className="grid grid-cols-3 gap-2">
          <input name="nome" placeholder="Nome (ex: Leads mensais)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="valorAlvo" type="number" step="any" placeholder="Valor alvo" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="unidade" placeholder="Unidade (ex: leads, R$)" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <button className="col-span-3 bg-neutral-900 text-white rounded-md py-1.5 text-sm hover:bg-neutral-800">+ Adicionar meta</button>
        </form>}
      </Card>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-3">Histórico do cliente (reclamações, intervenções, ações de CS...)</h2>
        {podeGerenciar && <form onSubmit={handleEvento} className="grid md:grid-cols-3 gap-2 mb-4">
          <select name="tipo" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
            {Object.entries(TIPO_EVENTO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <input name="descricao" placeholder="Descreva o ocorrido" required className="md:col-span-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <button className="bg-neutral-900 text-white rounded-md py-1.5 text-sm hover:bg-neutral-800">+ Registrar</button>
        </form>}

        <div className="space-y-2">
          {eventos.map((e) => (
            <div key={e.id} className="border-l-2 border-neutral-200 pl-3 py-1">
              <div className="text-xs text-neutral-400">
                {format(new Date(e.dataOcorrencia), "dd/MM/yyyy", { locale: ptBR })} · {TIPO_EVENTO_LABEL[e.tipo]}
              </div>
              <div className="text-sm text-neutral-800">{e.descricao}</div>
            </div>
          ))}
          {eventos.length === 0 && <p className="text-sm text-neutral-500">Nenhum evento registrado ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
