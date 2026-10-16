"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth, getProjetoIdsDoUsuario, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import Link from "next/link";
import { Card } from "@/components/ui";

export default function NovoClientePage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projetoIdPreSelecionado = searchParams.get("projetoId") ?? "";
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!pronto || !db || !user) return null;
  if (!temPermissao(user, "gerenciarClientes")) return <p className="text-sm text-neutral-500">Você não tem permissão para gerenciar clientes.</p>;

  const projetosPermitidos = user.papel === "ADMIN" ? null : new Set(getProjetoIdsDoUsuario(user.id));
  const projetos = db.projetos.filter((p) => !projetosPermitidos || projetosPermitidos.has(p.id)).slice().sort((a, b) => a.nome.localeCompare(b.nome));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    const formData = new FormData(e.currentTarget);

    const projetoId = String(formData.get("projetoId") ?? "");
    const nome = String(formData.get("nome") ?? "").trim();
    const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
    const segmento = String(formData.get("segmento") ?? "").trim() || null;
    const inicioContrato = String(formData.get("inicioContrato") ?? "").trim() || null;
    const contatoNome = String(formData.get("contatoNome") ?? "").trim();
    const contatoEmail = String(formData.get("contatoEmail") ?? "").trim();
    const contatoCargo = String(formData.get("contatoCargo") ?? "").trim() || null;

    if (!nome || !projetoId) {
      setErro("Informe o nome do cliente e selecione um projeto.");
      return;
    }
    if (!projetos.some((p) => p.id === projetoId)) {
      setErro("Você não tem acesso ao projeto selecionado.");
      return;
    }
    if (contatoNome && !contatoEmail) {
      setErro("Informe o email do contato principal ou deixe os dados do contato em branco.");
      return;
    }

    const agora = new Date().toISOString();
    const clienteId = novoId("cliente");

    setSalvando(true);
    mutateDb((dbW) => {
      dbW.clientes.push({
        id: clienteId,
        projetoId,
        nome,
        cnpj,
        segmento,
        inicioContrato,
        status: "ATIVO",
        criadoEm: agora,
      });
      if (contatoNome) {
        dbW.contatosCliente.push({
          id: novoId("contato"),
          clienteId,
          nome: contatoNome,
          email: contatoEmail,
          cargo: contatoCargo,
          telefone: null,
          principal: true,
          criadoEm: agora,
        });
      }
      dbW.perfisRisco.push({
        id: novoId("perfil"),
        clienteId,
        propensaoRisco: 0,
        tendencia: "ESTAVEL",
        atualizadoEm: agora,
      });
    });

    router.push(`/clientes/detalhe?id=${clienteId}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div><div className="mb-4 flex items-center gap-2 text-xs font-medium text-neutral-500"><Link href="/clientes" className="hover:underline">Clientes</Link><span aria-hidden="true">/</span><span>Novo cliente</span></div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Relacionamento · cadastro</p><h1>Novo cliente</h1><p className="mb-0 mt-2 max-w-2xl text-sm text-neutral-500">Adicione o cliente à carteira e, se desejar, cadastre seu contato principal.</p></div>
      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      <Card className="client-create-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="form-section">
            <div className="mb-4 border-b border-neutral-100 pb-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Etapa 1</p><h2 className="mb-0 text-base font-semibold">Dados do cliente</h2><p className="mb-0 mt-1 text-xs text-neutral-500">Informações básicas para organizar o relacionamento.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="cliente-projeto" className="block text-sm font-medium text-neutral-700 mb-1">Projeto <span className="text-red-600">*</span></label>
            <select
              id="cliente-projeto"
              name="projetoId"
              required
              defaultValue={projetos.some((p) => p.id === projetoIdPreSelecionado) ? projetoIdPreSelecionado : ""}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            {projetos.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Nenhum projeto criado ainda — crie um projeto primeiro.</p>
            )}
          </div>
          <div>
            <label htmlFor="cliente-nome" className="block text-sm font-medium text-neutral-700 mb-1">Nome do cliente <span className="text-red-600">*</span></label>
            <input id="cliente-nome" name="nome" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="cliente-cnpj" className="block text-sm font-medium text-neutral-700 mb-1">CNPJ</label>
            <input id="cliente-cnpj" name="cnpj" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="cliente-segmento" className="block text-sm font-medium text-neutral-700 mb-1">Segmento</label>
            <input id="cliente-segmento" name="segmento" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="cliente-inicio-contrato" className="block text-sm font-medium text-neutral-700 mb-1">Início do contrato</label>
            <input id="cliente-inicio-contrato" type="date" name="inicioContrato" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
            </div>
          </section>

          <section className="form-section">
          <div className="mb-4 border-b border-neutral-100 pb-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Etapa 2 · opcional</p><h2 className="mb-0 text-base font-semibold">Contato principal</h2></div>
          <p className="mb-3 text-xs text-neutral-500">Preencha o nome e o email para habilitar o envio do questionário ao cliente.</p>
          <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="contato-nome" className="block text-sm font-medium text-neutral-700 mb-1">Nome</label>
            <input id="contato-nome" name="contatoNome" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="contato-email" className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input id="contato-email" type="email" name="contatoEmail" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="contato-cargo" className="block text-sm font-medium text-neutral-700 mb-1">Cargo</label>
            <input id="contato-cargo" name="contatoCargo" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <button type="submit" disabled={salvando || projetos.length === 0} className="action-button action-primary">
            {salvando ? "Salvando…" : "Criar cliente"}
          </button>
          <Link href="/clientes" className="action-button action-secondary">Cancelar</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
