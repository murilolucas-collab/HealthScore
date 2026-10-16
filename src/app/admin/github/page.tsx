"use client";

import { useEffect, useState } from "react";
import { useAuth, isAdminGeral } from "@/lib/auth-client";
import { getDb, substituirDb } from "@/lib/store";
import { buscarDbRemoto, salvarDbRemoto } from "@/lib/github-sync";
import { Card } from "@/components/ui";

export default function GithubStatusPage() {
  const { user, pronto } = useAuth();
  const [status, setStatus] = useState<"verificando" | "ativo" | "inativo">("verificando");
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarDbRemoto().then((resultado) => {
      if (cancelado) return;
      setStatus(resultado.existe !== null ? "ativo" : "inativo");
      if (resultado.existe === null) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (!pronto || !user) return null;
  if (!isAdminGeral(user)) return <p className="text-sm text-neutral-500">Ação restrita ao Admin Geral.</p>;

  async function handleCarregarAgora() {
    setCarregando("carregando");
    setMensagem(null);
    try {
      const remoto = await buscarDbRemoto();
      if (remoto.existe === true) {
        substituirDb(remoto.db);
        setStatus("ativo");
        setMensagem({ tipo: "ok", texto: "Dados atualizados a partir do GitHub. A cópia local foi substituída pela versão remota." });
      } else if (remoto.existe === false) {
        setStatus("inativo");
        setMensagem({ tipo: "erro", texto: "O arquivo remoto ainda não existe. Nenhum dado local foi alterado." });
      } else {
        setStatus("inativo");
        setMensagem({ tipo: "erro", texto: remoto.erro });
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível carregar os dados. Tente novamente." });
    } finally {
      setCarregando(null);
    }
  }

  async function handleSalvarAgora() {
    setCarregando("salvando");
    setMensagem(null);
    try {
      const resultado = await salvarDbRemoto(getDb());
      if (resultado.ok) {
        setStatus("ativo");
        setMensagem({ tipo: "ok", texto: "A versão local foi enviada ao GitHub." });
      } else {
        setStatus("inativo");
        setMensagem({ tipo: "erro", texto: `Os dados continuam neste navegador, mas não foram enviados: ${resultado.erro}` });
      }
    } catch {
      setStatus("inativo");
      setMensagem({ tipo: "erro", texto: "Falha inesperada ao enviar. Os dados locais foram mantidos." });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Admin Geral · armazenamento</p>
        <h1>Sincronização de dados</h1>
        <p className="mb-0 mt-2 max-w-2xl text-sm text-neutral-500">Gerencie a cópia compartilhada dos dados da equipe e confira o resultado de cada operação.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Armazenamento</p><p className="mb-0 text-sm font-semibold text-neutral-900">Arquivo compartilhado do GitHub</p><p className="mb-0 mt-1 text-xs text-neutral-500">Uma fonte comum para os dados do HealthScore.</p></div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Condição atual</p><p className="mb-0 text-sm font-semibold text-neutral-900">{status === "verificando" ? "Verificando conexão" : status === "ativo" ? "Conexão disponível" : "Conexão indisponível"}</p><p className="mb-0 mt-1 text-xs text-neutral-500">A leitura inicial não altera os dados locais.</p></div>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={`text-sm rounded-md px-4 py-3 border ${
            mensagem.tipo === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Estado da integração</p><h2 className="mb-1 font-semibold text-neutral-900">Conexão com a fonte de dados</h2><p className="mb-0 text-xs text-neutral-500">Verificação de leitura e gravação do arquivo remoto.</p></div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${status === "ativo" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "inativo" ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
          <span
            aria-hidden="true"
            className={`inline-block w-2 h-2 rounded-full ${
              status === "ativo" ? "bg-emerald-500" : status === "inativo" ? "bg-red-400" : "bg-neutral-300"
            }`}
          />
            {status === "ativo" && "Sincronização ativa"}
            {status === "inativo" && "Sincronização indisponível no momento"}
            {status === "verificando" && "Verificando..."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCarregarAgora}
            disabled={!!carregando}
            className="bg-neutral-900 text-white rounded-md px-4 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {carregando === "carregando" ? "Carregando..." : "Carregar dados mais recentes"}
          </button>
          <button
            onClick={handleSalvarAgora}
            disabled={!!carregando}
            className="bg-neutral-900 text-white rounded-md px-4 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {carregando === "salvando" ? "Salvando..." : "Forçar salvar agora"}
          </button>
        </div>
      </Card>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"><strong>Antes de carregar:</strong> essa operação substitui a cópia local pela versão do GitHub. Use-a somente quando quiser descartar alterações locais não sincronizadas. Para enviar os dados deste navegador, escolha “Forçar salvar agora”.</div>
    </div>
  );
}
