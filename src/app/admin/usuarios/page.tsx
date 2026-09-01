"use client";

import { useAuth } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId, excluirUsuario } from "@/lib/store";
import { Card } from "@/components/ui";
import bcrypt from "bcryptjs";
import type { PapelUsuario } from "@/lib/types";

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
        criadoEm: new Date().toISOString(),
      });
    });
    e.currentTarget.reset();
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
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase text-neutral-400">{u.papel}</span>
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
