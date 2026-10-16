"use client";

import { isAdminGeral, useAuth, permissoesEfetivas } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId, excluirUsuario } from "@/lib/store";
import { Card } from "@/components/ui";
import bcrypt from "bcryptjs";
import type { ModuloUsuario, PapelUsuario, PermissoesUsuario } from "@/lib/types";

const MODULOS: { chave: ModuloUsuario; titulo: string }[] = [
  { chave: "verDashboard", titulo: "Ver dashboard" },
  { chave: "verProjetos", titulo: "Ver projetos" },
  { chave: "verClientes", titulo: "Ver clientes" },
  { chave: "gerenciarClientes", titulo: "Gerenciar contatos, metas e eventos" },
  { chave: "alterarStatusCliente", titulo: "Alterar status do cliente" },
  { chave: "calcularSaude", titulo: "Calcular saúde" },
];

function permissoesDoFormulario(formData: FormData): PermissoesUsuario {
  return Object.fromEntries(MODULOS.map(({ chave }) => [chave, formData.get(`permissao_${chave}`) === "on"])) as PermissoesUsuario;
}

export default function UsuariosPage() {
  const { user, pronto } = useAuth();
  const db = useDb();

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  const usuarios = db.usuarios
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((u) => ({
      ...u,
      acessos: db.acessosProjeto
        .filter((a) => a.usuarioId === u.id)
        .map((a) => db.projetos.find((p) => p.id === a.projetoId))
        .filter(Boolean),
    }));
  const projetosDisponiveis = db.projetos.slice().sort((a, b) => a.nome.localeCompare(b.nome));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const senha = String(formData.get("senha") ?? "");
    const papel = String(formData.get("papel") ?? "PADRAO") as PapelUsuario;
    const permissoes = permissoesDoFormulario(formData);

    if (!nome || !email || senha.length < 6) {
      alert("Nome, email e senha (mín. 6 caracteres) são obrigatórios");
      return;
    }
    if (db!.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      alert("Já existe um usuário com esse email");
      return;
    }

    mutateDb((dbW) => {
      dbW.usuarios.push({
        id: novoId("usuario"),
        nome,
        email,
        senhaHash: bcrypt.hashSync(senha, 10),
        papel,
        permissoes: papel === "PADRAO" ? permissoes : undefined,
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
  }

  function handlePermissoes(e: React.FormEvent<HTMLFormElement>, usuarioId: string) {
    e.preventDefault();
    const permissoes = permissoesDoFormulario(new FormData(e.currentTarget));
    mutateDb((dbW) => {
      const usuario = dbW.usuarios.find((u) => u.id === usuarioId);
      if (usuario && !isAdminGeral(usuario)) usuario.permissoes = permissoes;
    });
  }

  function handleAcessosProjeto(e: React.FormEvent<HTMLFormElement>, usuarioId: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const projetosSelecionados = projetosDisponiveis.filter(
      (projeto) => formData.get(`projeto_${projeto.id}`) === "on"
    );

    mutateDb((dbW) => {
      dbW.acessosProjeto = dbW.acessosProjeto.filter((acesso) => acesso.usuarioId !== usuarioId);
      for (const projeto of projetosSelecionados) {
        dbW.acessosProjeto.push({
          id: novoId("acesso"),
          usuarioId,
          projetoId: projeto.id,
          criadoEm: new Date().toISOString(),
        });
      }
    });
  }

  function handleExcluir(alvo: { id: string; nome: string; papel: PapelUsuario }) {
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
        <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
          <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="senha" type="password" placeholder="Senha (mín. 6 caracteres)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <select name="papel" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="PADRAO">
            <option value="PADRAO">Padrão</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="md:col-span-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Permissões iniciais deste usuário</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MODULOS.map(({ chave, titulo }) => (
                <label key={chave} className="flex items-center gap-2 text-xs text-neutral-700">
                  <input type="checkbox" name={`permissao_${chave}`} defaultChecked={chave !== "gerenciarClientes" && chave !== "alterarStatusCliente"} />
                  {titulo}
                </label>
              ))}
            </div>
          </div>
          <button className="md:col-span-4 bg-neutral-900 text-white rounded-md py-1.5 text-sm hover:bg-neutral-800">+ Criar usuário</button>
        </form>
      </Card>

      <div className="grid gap-3">
        <p className="mb-0 text-xs font-semibold uppercase tracking-[.13em] text-neutral-500">Acessos individuais · {usuarios.length} usuário(s)</p>
        {usuarios.map((u) => (
          <Card key={u.id} className="user-access-card grid gap-5 lg:grid-cols-[minmax(180px,.65fr)_minmax(0,1.35fr)]">
            <div className="min-w-0">
              <div className="font-semibold text-neutral-900">{u.nome}</div>
              <div className="text-sm text-neutral-500">{u.email}</div>
              <span className="mt-3 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-900">{isAdminGeral(u) ? "Admin Geral" : u.papel === "ADMIN" ? "Administrador" : "Acesso padrão"}</span>
              {u.papel === "PADRAO" && (
                <div className="text-xs text-neutral-400 mt-1">
                  Projetos: {u.acessos.length > 0 ? u.acessos.map((p) => p!.nome).join(", ") : "nenhum ainda"}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <span className="text-xs uppercase text-neutral-400">{u.papel}</span>
              {!isAdminGeral(u) && (
                <form onSubmit={(e) => handlePermissoes(e, u.id)} className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-neutral-200 bg-neutral-50 p-2">
                  {MODULOS.map(({ chave, titulo }) => (
                    <label key={chave} className="flex items-center gap-1 text-[11px] text-neutral-600">
                      <input type="checkbox" name={`permissao_${chave}`} defaultChecked={permissoesEfetivas(u)[chave]} />
                      {titulo}
                    </label>
                  ))}
                  <button className="col-span-2 mt-1 text-left text-[11px] font-medium text-neutral-700 underline">Salvar módulos</button>
                </form>
              )}
              {isAdminGeral(u) && (
                <p className="max-w-xs text-right text-[11px] text-neutral-500">
                  Admin Geral: todos os módulos e a sincronização GitHub ficam sempre liberados.
                </p>
              )}
              {u.papel === "PADRAO" && (
                <form onSubmit={(e) => handleAcessosProjeto(e, u.id)} className="w-full rounded-md border border-neutral-200 bg-white p-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    Projetos que este usuário pode acessar
                  </p>
                  {projetosDisponiveis.length > 0 ? (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {projetosDisponiveis.map((projeto) => (
                        <label key={projeto.id} className="flex items-center gap-1 text-[11px] text-neutral-600">
                          <input
                            type="checkbox"
                            name={`projeto_${projeto.id}`}
                            defaultChecked={u.acessos.some((acesso) => acesso?.id === projeto.id)}
                          />
                          {projeto.nome}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-500">Nenhum projeto cadastrado.</p>
                  )}
                  <button className="mt-2 text-left text-[11px] font-medium text-neutral-700 underline">Salvar projetos</button>
                </form>
              )}
              <button
                onClick={() => handleExcluir(u)}
                className="text-xs text-red-600 underline hover:text-red-800"
              >
                Excluir
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
