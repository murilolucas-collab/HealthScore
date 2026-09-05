"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { Card } from "@/components/ui";

export default function NovoClientePage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projetoIdPreSelecionado = searchParams.get("projetoId") ?? "";

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  const projetos = db.projetos.slice().sort((a, b) => a.nome.localeCompare(b.nome));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      alert("Nome do cliente e projeto são obrigatórios");
      return;
    }

    const agora = new Date().toISOString();
    const clienteId = novoId("cliente");

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
    <div className="max-w-xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Novo cliente</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Projeto</label>
            <select
              name="projetoId"
              required
              defaultValue={projetoIdPreSelecionado}
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
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome do cliente</label>
            <input name="nome" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">CNPJ</label>
            <input name="cnpj" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Segmento</label>
            <input name="segmento" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Início do contrato</label>
            <input type="date" name="inicioContrato" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>

          <hr className="border-neutral-200" />
          <p className="text-sm font-medium text-neutral-700">Contato principal (opcional)</p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome</label>
            <input name="contatoNome" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input type="email" name="contatoEmail" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Cargo</label>
            <input name="contatoCargo" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>

          <button type="submit" className="bg-neutral-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-800">
            Criar cliente
          </button>
        </form>
      </Card>
    </div>
  );
}
