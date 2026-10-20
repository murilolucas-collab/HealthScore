"use client";

import { useRouter } from "next/navigation";
import { isAdminGeral, useAuth, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { Card } from "@/components/ui";

export default function NovoProjetoPage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const router = useRouter();

  if (!pronto || !db || !user) return null;
  if (!temPermissao(user, "verProjetos")) {
    return <p className="text-sm text-neutral-500">Você não tem permissão para visualizar projetos.</p>;
  }
  if (!isAdminGeral(user)) {
    return <p className="text-sm text-neutral-500">Somente o Admin Geral pode criar projetos e definir novos acessos fora de um escopo já autorizado.</p>;
  }

  const usuarios = db.usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get("nome") ?? "").trim();
    const csResponsavelId = String(formData.get("csResponsavelId") ?? "") || null;
    const dataInicio = String(formData.get("dataInicio") ?? "").trim() || null;

    if (!nome) {
      alert("Nome do projeto é obrigatório");
      return;
    }

    const projetoId = novoId("projeto");
    mutateDb((dbW) => {
      dbW.projetos.push({
        id: projetoId,
        nome,
        csResponsavelId,
        dataInicio,
        status: "ATIVO",
        criadoEm: new Date().toISOString(),
      });
      dbW.configuracoesCiclo.push({
        id: novoId("config"),
        projetoId,
        periodicidade: "MENSAL",
        diaDisparo: 1,
        ativo: true,
      });
      const responsavel = dbW.usuarios.find((usuario) => usuario.id === csResponsavelId);
      if (responsavel && responsavel.id !== user!.id && !isAdminGeral(responsavel)) {
        dbW.acessosProjeto.push({
          id: novoId("acesso"),
          usuarioId: responsavel.id,
          projetoId,
          criadoEm: new Date().toISOString(),
        });
      }
    });

    router.push("/projetos");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Novo projeto</h1>
        <p className="text-sm text-neutral-500">
          Cria o projeto vazio — depois é só entrar nele e adicionar os clientes um a um.
        </p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome do projeto</label>
            <input name="nome" required placeholder="Ex: Marketing 360" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">CS responsável</label>
            <select name="csResponsavelId" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" defaultValue="">
              <option value="">Sem responsável definido</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.papel})
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">O CS indicado recebe acesso explícito ao novo projeto. O Admin Geral mantém acesso total.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Data de início</label>
            <input type="date" name="dataInicio" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="action-button action-primary">
            Criar projeto
          </button>
        </form>
      </Card>
    </div>
  );
}
