"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-client";
import { getDb, substituirDb } from "@/lib/store";
import {
  getGithubConfig,
  setGithubConfig,
  limparGithubConfig,
  testarConexao,
  buscarDbRemoto,
  salvarDbRemoto,
  registrarShaConhecido,
  type GithubConfig,
} from "@/lib/github-sync";
import { Card } from "@/components/ui";

export default function GithubConfigPage() {
  const { user, pronto } = useAuth();
  const [configAtual, setConfigAtual] = useState<GithubConfig | null>(() => getGithubConfig());
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  if (!pronto || !user) return null;

  async function handleSalvarConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const owner = String(formData.get("owner") ?? "").trim();
    const repo = String(formData.get("repo") ?? "").trim();
    const branch = String(formData.get("branch") ?? "main").trim() || "main";
    const token = String(formData.get("token") ?? "").trim();

    if (!owner || !repo || !token) {
      setMensagem({ tipo: "erro", texto: "Preencha usuário, repositório e token." });
      return;
    }

    const cfg: GithubConfig = { owner, repo, branch, token };
    setCarregando("testando");
    setMensagem(null);

    const teste = await testarConexao(cfg);
    if (!teste.ok) {
      setCarregando(null);
      setMensagem({ tipo: "erro", texto: teste.erro });
      return;
    }

    setGithubConfig(cfg);
    setConfigAtual(cfg);

    setCarregando("carregando");
    const remoto = await buscarDbRemoto(cfg);
    if (remoto.existe === true) {
      substituirDb(remoto.db);
      registrarShaConhecido(remoto.sha);
      setMensagem({ tipo: "ok", texto: "Conectado! Dados mais recentes do GitHub carregados." });
    } else if (remoto.existe === false) {
      const salvo = await salvarDbRemoto(cfg, getDb());
      setMensagem(
        salvo.ok
          ? { tipo: "ok", texto: "Conectado! Como o arquivo ainda não existia, os dados atuais foram enviados ao GitHub." }
          : { tipo: "erro", texto: salvo.erro }
      );
    } else {
      setMensagem({ tipo: "erro", texto: remoto.erro });
    }
    setCarregando(null);
  }

  async function handleCarregarAgora() {
    if (!configAtual) return;
    setCarregando("carregando");
    setMensagem(null);
    const remoto = await buscarDbRemoto(configAtual);
    if (remoto.existe === true) {
      substituirDb(remoto.db);
      registrarShaConhecido(remoto.sha);
      setMensagem({ tipo: "ok", texto: "Dados atualizados a partir do GitHub." });
    } else if (remoto.existe === false) {
      setMensagem({ tipo: "erro", texto: "O arquivo de dados ainda não existe nesse repositório." });
    } else {
      setMensagem({ tipo: "erro", texto: remoto.erro });
    }
    setCarregando(null);
  }

  async function handleSalvarAgora() {
    if (!configAtual) return;
    setCarregando("salvando");
    setMensagem(null);
    const resultado = await salvarDbRemoto(configAtual, getDb());
    setMensagem(
      resultado.ok
        ? { tipo: "ok", texto: "Dados enviados para o GitHub com sucesso." }
        : { tipo: "erro", texto: resultado.erro }
    );
    setCarregando(null);
  }

  function handleDesconectar() {
    limparGithubConfig();
    setConfigAtual(null);
    setMensagem({ tipo: "ok", texto: "Integração desconectada. Os dados continuam salvos neste navegador." });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Sincronização com GitHub</h1>
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

      {configAtual ? (
        <Card>
          <h2 className="font-medium text-neutral-900 mb-1">Conectado</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Repositório: <span className="font-medium">{configAtual.owner}/{configAtual.repo}</span> (branch{" "}
            {configAtual.branch})
          </p>
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
            <button
              onClick={handleDesconectar}
              disabled={!!carregando}
              className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50"
            >
              Desconectar
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSalvarConfig} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Usuário/organização do GitHub</label>
              <input name="owner" required placeholder="murilolucas-collab" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Repositório</label>
              <input name="repo" required placeholder="HealthScore" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Branch</label>
              <input name="branch" defaultValue="main" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Token de acesso pessoal</label>
              <input name="token" type="password" required placeholder="github_pat_..." className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <button
              type="submit"
              disabled={!!carregando}
              className="bg-neutral-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {carregando === "testando" ? "Testando conexão..." : carregando === "carregando" ? "Carregando dados..." : "Conectar"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
