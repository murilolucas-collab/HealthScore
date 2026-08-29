"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-client";
import { mutateDb, novoId } from "@/lib/store";
import { Card } from "@/components/ui";

export default function NovoClientePage() {
  const { user, pronto } = useAuth();
  const router = useRouter();

  if (!pronto || !user) return null;
  if (user.papel !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const nome = String(formData.get("nome") ?? "").trim();
    const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
    const segmento = String(formData.get("segmento") ?? "").trim() || null;
    const inicioContrato = String(formData.get("inicioContrato") ?? "").trim() || null;
    const contatoNome = String(formData.get("contatoNome") ?? "").trim();
    const contatoEmail = String(formData.get("contatoEmail") ?? "").trim();
    const contatoCargo = String(formData.get("contatoCargo") ?? "").trim() || null;

    if (!nome) {
      alert("Nome do cliente é obrigatório");
      return;
    }

    const agora = new Date().toISOString();
    const clienteId = novoId("cliente");

    mutateDb((db) => {
      db.clientes.push({
        id: clienteId,
        nome,
        cnpj,
        segmento,
        inicioContrato,
        status: "ATIVO",
        criadoEm: agora,
      });
      if (contatoNome) {
        db.contatosCliente.push({
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
      db.perfisRisco.push({
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
