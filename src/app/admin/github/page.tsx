"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-client";
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

  async function handleCarregarAgora() {
    setCarregando("carregando");
    setMensagem(null);
    const remoto = await buscarDbRemoto();
    if (remoto.existe === true) {
      substituirDb(remoto.db);
      setStatus("ativo");
      setMensagem({ tipo: "ok", texto: "Dados atualizados a partir do GitHub." });
    } else if (remoto.existe === false) {
      setStatus("ativo");
      setMensagem({ tipo: "erro", texto: "O arquivo de dados ainda não existe no repositório." });
    } else {
      setStatus("inativo");
      setMensagem({ tipo: "erro", texto: remoto.erro });
    }
    setCarregando(null);
  }

  async function handleSalvarAgora() {
    setCarregando("salvando");
    setMensagem(null);
    const resultado = await salvarDbRemoto(getDb());
    if (resultado.ok) {
      setStatus("ativo");
      setMensagem({ tipo: "ok", texto: "Dados enviados para o GitHub com sucesso." });
    } else {
      setStatus("inativo");
      setMensagem({ tipo: "erro", texto: resultado.erro });
    }
    setCarregando(null);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Sincronização com GitHub</h1>
        <p className="text-sm text-neutral-500">
          A sincronização é automática: tudo que você faz aqui é salvo sozinho, poucos segundos depois, sem precisar
          de nenhuma configuração.
        </p>
      </div>

      {mensagem && (
        <p
          className={`text-sm rounded-md px-3 py-2 border ${
            mensagem.tipo === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === "ativo" ? "bg-emerald-500" : status === "inativo" ? "bg-red-400" : "bg-neutral-300"
            }`}
          />
          <span className="text-sm text-neutral-700">
            {status === "ativo" && "Sincronização ativa"}
            {status === "inativo" && "Sincronização indisponível no momento"}
            {status === "verificando" && "Verificando..."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCarregarAgora}
            disabled={!!carregando}
            className="bg-neutral-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {carregando === "carregando" ? "Carregando..." : "Carregar dados mais recentes"}
          </button>
          <button
            onClick={handleSalvarAgora}
            disabled={!!carregando}
            className="bg-neutral-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {carregando === "salvando" ? "Salvando..." : "Forçar salvar agora"}
          </button>
        </div>
      </Card>
    </div>
  );
}
