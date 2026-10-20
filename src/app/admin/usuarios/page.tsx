"use client";

import { getProjetoIdsDoUsuario, isAdminGeral, useAuth, permissoesEfetivas } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { materializarEscopoProjetosUsuario, mutateDb, novoId, excluirUsuario } from "@/lib/store";
import { Card } from "@/components/ui";
import bcrypt from "bcryptjs";
import type { ModuloUsuario, PapelUsuario, PermissoesUsuario } from "@/lib/types";
import { useState } from "react";

const MODULOS: { chave: ModuloUsuario; titulo: string }[] = [
  { chave: "verClientes", titulo: "Clientes" },
  { chave: "verDashboard", titulo: "Dashboard" },
  { chave: "verProjetos", titulo: "Projetos" },
  { chave: "gerenciarClientes", titulo: "Gerenciar contatos" },
  { chave: "calcularSaude", titulo: "Calcular saúde" },
];

function permissoesDoFormulario(formData: FormData): PermissoesUsuario {
  return Object.fromEntries(MODULOS.map(({ chave }) => [chave, formData.get(`permissao_${chave}`) === "on"])) as PermissoesUsuario;
}

export default function UsuariosPage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const [usuarioExpandido, setUsuarioExpandido] = useState<string | null>(null);

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  const adminGeral = isAdminGeral(user);
  const escopoOperador = new Set(getProjetoIdsDoUsuario(user.id));
  const usuarios = db.usuarios
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((u) => {
      const projetosAutorizados = new Set(getProjetoIdsDoUsuario(u.id));
      return {
        ...u,
        acessos: db.projetos
          .filter((p) => projetosAutorizados.has(p.id) && (adminGeral || escopoOperador.has(p.id)))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        acessosForaDoEscopo: adminGeral ? 0 : db.projetos.filter((p) => projetosAutorizados.has(p.id) && !escopoOperador.has(p.id)).length,
      };
    });
  const projetosDisponiveis = db.projetos
    .filter((projeto) => adminGeral || escopoOperador.has(projeto.id))
    .slice().sort((a, b) => a.nome.localeCompare(b.nome));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const senha = String(formData.get("senha") ?? "");
    const papel = String(formData.get("papel") ?? "PADRAO") as PapelUsuario;
    const permissoes = permissoesDoFormulario(formData);

    if (papel !== "PADRAO" && papel !== "ADMIN") {
      alert("Perfil de usuário inválido.");
      return;
    }
    if (papel === "ADMIN" && !isAdminGeral(user!)) {
      alert("Somente o Admin Geral pode criar contas de administrador.");
      return;
    }

    if (!nome || !email || senha.length < 6) {
      alert("Nome, email e senha (mín. 6 caracteres) são obrigatórios");
      return;
    }
    if (db!.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      alert("Já existe um usuário com esse email");
      return;
    }

    mutateDb((dbW) => {
      if (papel === "ADMIN" && !isAdminGeral(user!)) return;
      dbW.usuarios.push({
        id: novoId("usuario"),
        nome,
        email,
        senhaHash: bcrypt.hashSync(senha, 10),
        papel,
        permissoes,
        escopoProjetosConfigurado: true,
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function handlePermissoes(e: React.FormEvent<HTMLFormElement>, usuarioId: string) {
    e.preventDefault();
    if (usuarioId === user!.id && !isAdminGeral(user!)) {
      alert("Por segurança, você não pode alterar suas próprias permissões. Peça a outro administrador.");
      return;
    }
    const permissoes = permissoesDoFormulario(new FormData(e.currentTarget));
    mutateDb((dbW) => {
      const usuario = dbW.usuarios.find((u) => u.id === usuarioId);
      if (usuario && usuarioId !== user!.id && !isAdminGeral(usuario)) usuario.permissoes = permissoes;
    });
  }

  function handleAcessosProjeto(e: React.FormEvent<HTMLFormElement>, usuarioId: string) {
    e.preventDefault();
    if (usuarioId === user!.id && !isAdminGeral(user!)) {
      alert("Por segurança, você não pode alterar seu próprio acesso a projetos. Peça a outro administrador.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const projetosSelecionados = projetosDisponiveis.filter(
      (projeto) => formData.get(`projeto_${projeto.id}`) === "on"
    );

    mutateDb((dbW) => {
      const usuario = dbW.usuarios.find((u) => u.id === usuarioId);
      if (!usuario || usuarioId === user!.id || isAdminGeral(usuario)) return;
      materializarEscopoProjetosUsuario(dbW, usuario);
      const idsNoEscopoEditavel = new Set(projetosDisponiveis.map((projeto) => projeto.id));
      // Esta é uma edição parcial para admins limitados: grants fora do
      // escopo visível ficam preservados, inclusive os de ADMINs legados.
      dbW.acessosProjeto = dbW.acessosProjeto.filter(
        (acesso) => acesso.usuarioId !== usuarioId || !idsNoEscopoEditavel.has(acesso.projetoId)
      );
      const idsMantidos = new Set(
        dbW.acessosProjeto.filter((acesso) => acesso.usuarioId === usuarioId).map((acesso) => acesso.projetoId)
      );
      for (const projeto of projetosSelecionados) {
        if (idsMantidos.has(projeto.id)) continue;
        dbW.acessosProjeto.push({
          id: novoId("acesso"),
          usuarioId,
          projetoId: projeto.id,
          criadoEm: new Date().toISOString(),
        });
      }
      // O helper marca true inclusive quando o usuário remove todos os
      // projetos editáveis; seleção vazia não volta ao modo legado.
    });
  }

  function handleExcluir(alvo: { id: string; nome: string; papel: PapelUsuario }) {
    if (db!.usuarios.some((u) => u.id === alvo.id && isAdminGeral(u))) {
      alert("O Admin Geral é protegido e não pode ser excluído.");
      return;
    }
    if (alvo.id === user!.id) {
      alert("Você não pode excluir o próprio usuário logado.");
      return;
    }
    if (alvo.papel === "ADMIN" && db!.usuarios.filter((u) => u.papel === "ADMIN").length <= 1) {
      alert("Não é possível excluir o último administrador.");
      return;
    }
    if (!window.confirm(`Excluir o usuário "${alvo.nome}"? Ele perde acesso imediatamente. Essa ação não pode ser desfeita.`)) {
      return;
    }
    mutateDb((dbW) => excluirUsuario(dbW, alvo.id));
  }

  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Equipe e acessos</p><h1>Usuários</h1><p className="mb-0 mt-2 text-sm text-neutral-500">Configure permissões e projetos individualmente para cada pessoa.</p></div>

      <Card>
        <h2 className="font-semibold text-neutral-900 mb-1">Adicionar pessoa à equipe</h2>
        <p className="mb-4 text-sm text-neutral-500">Cada conta recebe seu próprio conjunto de módulos e projetos autorizados.</p>
        <form onSubmit={handleSubmit} className="user-create-form grid grid-cols-1 gap-2 md:grid-cols-4">
          <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="senha" type="password" placeholder="Senha (mín. 6 caracteres)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          {adminGeral ? (
            <select name="papel" aria-label="Perfil do novo usuário" className="min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="PADRAO">
              <option value="PADRAO">Padrão</option>
              <option value="ADMIN">Admin</option>
            </select>
          ) : (
            <div className="flex min-w-0 items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-600">
              Padrão<input type="hidden" name="papel" value="PADRAO" />
            </div>
          )}
          <div className="md:col-span-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Permissões iniciais deste usuário</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODULOS.map(({ chave, titulo }) => (
                <label key={chave} className="flex items-center gap-2 text-xs text-neutral-700">
                  <input type="checkbox" name={`permissao_${chave}`} defaultChecked={chave !== "gerenciarClientes"} />
                  {titulo}
                </label>
              ))}
            </div>
          </div>
          <button className="action-button action-primary md:col-span-4">+ Criar usuário</button>
        </form>
      </Card>

      <div className="grid gap-3">
        <p className="mb-0 text-xs font-semibold uppercase tracking-[.13em] text-neutral-500">Acessos individuais · {usuarios.length} usuário(s)</p>
        {usuarios.map((u) => {
          const expandido = usuarioExpandido === u.id;
          const raiz = isAdminGeral(u);
          const podeEditar = !raiz && u.id !== user.id;
          const painelId = `acessos-usuario-${u.id}`;
          const resumoProjetos = raiz
            ? "Todos os projetos"
            : u.acessos.length > 0
              ? `${u.acessos.map((p) => p.nome).join(", ")}${u.acessosForaDoEscopo ? ` · +${u.acessosForaDoEscopo} fora do seu escopo` : ""}`
              : u.acessosForaDoEscopo > 0
                ? `${u.acessosForaDoEscopo} projeto(s) fora do seu escopo`
                : "Nenhum projeto autorizado";

          return (
            <Card key={u.id} className="user-access-card grid gap-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900">{u.nome}</div>
                  <div className="break-all text-sm text-neutral-500">{u.email}</div>
                  <span className="mt-2 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-900">{raiz ? "Admin Geral" : u.papel === "ADMIN" ? "Administrador" : "Acesso padrão"}</span>
                  <p className="mb-0 mt-2 text-xs text-neutral-500">Projetos: {resumoProjetos}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs uppercase text-neutral-400">{u.papel}</span>
                  <button
                    type="button"
                    aria-expanded={expandido}
                    aria-controls={painelId}
                    aria-label={`${expandido ? "Fechar" : "Gerenciar"} acessos de ${u.nome}`}
                    onClick={() => setUsuarioExpandido(expandido ? null : u.id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-950 transition hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {expandido ? <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></> : <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
                    </svg>
                    Gerenciar acessos
                  </button>
                </div>
              </div>

              <div id={painelId} hidden={!expandido} className="grid min-w-0 gap-3 border-t border-neutral-200 pt-4">
                {raiz ? (
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                    <p className="mb-1 text-sm font-semibold text-teal-950">Acesso total protegido</p>
                    <p className="mb-0 text-xs text-teal-900">Admin Geral mantém os cinco módulos e todos os projetos liberados. Essas permissões não podem ser alteradas.</p>
                    <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-teal-950 sm:grid-cols-2">
                      {MODULOS.map(({ chave, titulo }) => <li key={chave}>✓ {titulo}</li>)}
                    </ul>
                  </div>
                ) : (
                  <>
                    {!podeEditar && <p className="mb-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Por segurança, você não pode editar seus próprios módulos ou projetos. Peça a outro administrador para fazer essa alteração.</p>}
                    <form onSubmit={(e) => handlePermissoes(e, u.id)} className="grid min-w-0 gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="mb-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">Módulos individuais</p>
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        {MODULOS.map(({ chave, titulo }) => (
                          <label key={chave} className="flex min-w-0 items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" name={`permissao_${chave}`} disabled={!podeEditar} defaultChecked={permissoesEfetivas(u)[chave]} />
                            {titulo}
                          </label>
                        ))}
                      </div>
                      <button type="submit" disabled={!podeEditar} className="inline-action inline-action-secondary justify-self-start disabled:cursor-not-allowed disabled:opacity-50">Salvar módulos</button>
                    </form>

                    <form onSubmit={(e) => handleAcessosProjeto(e, u.id)} className="grid min-w-0 gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Projetos autorizados</p>
                        <p className="mb-0 text-xs text-neutral-500">A seleção vale para todos os perfis, inclusive Administrador. Sem seleção, a conta não acessa nenhum projeto. Admins antigos sem escopo configurado preservam o acesso atual até que esta lista seja salva.</p>
                      </div>
                      {projetosDisponiveis.length > 0 ? (
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                          {projetosDisponiveis.map((projeto) => (
                            <label key={projeto.id} className="flex min-w-0 items-center gap-2 break-words text-sm text-neutral-700">
                              <input type="checkbox" name={`projeto_${projeto.id}`} disabled={!podeEditar} defaultChecked={u.acessos.some((acesso) => acesso.id === projeto.id)} />
                              {projeto.nome}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-0 text-sm text-neutral-500">Nenhum projeto cadastrado.</p>
                      )}
                      <button type="submit" disabled={!podeEditar} className="inline-action inline-action-secondary justify-self-start disabled:cursor-not-allowed disabled:opacity-50">Salvar projetos</button>
                    </form>
                  </>
                )}
              </div>

              {!raiz && <button type="button" onClick={() => handleExcluir(u)} className="inline-action inline-action-danger justify-self-start">Excluir usuário</button>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
