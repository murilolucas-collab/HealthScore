"use client";

import { useAuth, permissoesEfetivas } from "@/lib/auth-client";
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
      if (usuario && usuario.papel === "PADRAO") usuario.permissoes = permissoes;
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
      <h1 className="text-lg font-semibold text-neutral-900">Usuários</h1>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-3">Novo usuário</h2>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
          <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="senha" type="password" placeholder="Senha (mín. 6 caracteres)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          <select name="papel" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="PADRAO">
            <option value="PADRAO">Padrão</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="md:col-span-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Módulos do usuário padrão</p>
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
        {usuarios.map((u) => (
          <Card key={u.id} className="flex items-center justify-between">
            <div>
              <div className="font-medium text-neutral-900">{u.nome}</div>
              <div className="text-sm text-neutral-500">{u.email}</div>
              {u.papel === "PADRAO" && (
                <div className="text-xs text-neutral-400 mt-1">
                  Projetos: {u.acessos.length > 0 ? u.acessos.map((p) => p!.nome).join(", ") : "nenhum ainda"}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase text-neutral-400">{u.papel}</span>
              {u.papel === "PADRAO" && (
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
