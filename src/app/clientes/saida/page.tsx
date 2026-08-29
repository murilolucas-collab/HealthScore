"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, podeAcessarProjeto } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { Card } from "@/components/ui";
import type { MotivoSaida } from "@/lib/types";

const MOTIVOS: { valor: MotivoSaida; label: string }[] = [
  { valor: "PRECO", label: "Preço" },
  { valor: "RESULTADOS_INSATISFATORIOS", label: "Resultados insatisfatórios" },
  { valor: "ATENDIMENTO_COMUNICACAO", label: "Atendimento/comunicação" },
  { valor: "CORTE_ORCAMENTO_CLIENTE", label: "Corte de orçamento do cliente" },
  { valor: "MUDANCA_ESTRATEGIA_CLIENTE", label: "Mudança de estratégia do cliente" },
  { valor: "ENCERRAMENTO_EMPRESA_CLIENTE", label: "Encerramento da empresa do cliente" },
  { valor: "CONCORRENCIA", label: "Foi para a concorrência" },
  { valor: "PROBLEMAS_INTERNOS_AGENCIA", label: "Problemas internos da agência" },
  { valor: "OUTRO", label: "Outro" },
];

export default function FormularioSaidaPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { user, pronto } = useAuth();
  const db = useDb();
  const router = useRouter();

  const cliente = db?.clientes.find((c) => c.id === id);
  const clienteEncerrado = cliente?.status === "INATIVO";

  useEffect(() => {
    if (clienteEncerrado && cliente) {
      router.replace(`/clientes/detalhe?id=${cliente.id}`);
    }
  }, [clienteEncerrado, cliente, router]);

  if (!pronto || !db || !user) return null;
  if (!cliente) return <p className="text-sm text-neutral-500">Cliente não encontrado.</p>;

  const projetosDoCliente = db.projetos.filter((p) => p.clienteId === id);
  if (user.papel !== "ADMIN") {
    const temAcesso = projetosDoCliente.some((p) => podeAcessarProjeto(user, p.id));
    if (!temAcesso) return <p className="text-sm text-neutral-500">Cliente não encontrado.</p>;
  }

  if (clienteEncerrado) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const motivoPrincipal = String(formData.get("motivoPrincipal") ?? "OUTRO") as MotivoSaida;
    const detalhamento = String(formData.get("detalhamento") ?? "").trim();
    const poderiaSerEvitado = formData.get("poderiaSerEvitado") === "on";
    const notaStr = String(formData.get("notaSatisfacaoGeral") ?? "").trim();
    const notaSatisfacaoGeral = notaStr ? Number(notaStr) : null;

    if (!detalhamento) {
      alert("Descreva o que motivou a saída do cliente");
      return;
    }

    mutateDb((dbW) => {
      dbW.formulariosSaida.push({
        id: novoId("saida"),
        clienteId: id,
        motivoPrincipal,
        detalhamento,
        poderiaSerEvitado,
        notaSatisfacaoGeral,
        responsavelId: user!.id,
        dataSaida: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
      });
      const c = dbW.clientes.find((cl) => cl.id === id);
      if (c) c.status = "INATIVO";
    });

    router.push(`/clientes/detalhe?id=${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Formulário de saída</h1>
        <p className="text-sm text-neutral-500">
          {cliente.nome} — preencha os motivos antes de encerrar este cliente. Essa informação ajuda a mapear padrões
          de churn.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo principal</label>
            <select name="motivoPrincipal" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" defaultValue="">
              <option value="" disabled>
                Selecione...
              </option>
              {MOTIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Detalhamento</label>
            <textarea
              name="detalhamento"
              required
              rows={4}
              placeholder="Descreva com o máximo de contexto possível o que levou à saída do cliente..."
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nota de satisfação geral retrospectiva (0-10, opcional)
            </label>
            <input type="number" min={0} max={10} name="notaSatisfacaoGeral" className="w-24 rounded-md border border-neutral-300 px-3 py-2 text-sm text-center" />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="poderiaSerEvitado" />
            Essa saída poderia ter sido evitada pela agência
          </label>

          <button type="submit" className="bg-red-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-700">
            Confirmar saída e encerrar cliente
          </button>
        </form>
      </Card>
    </div>
  );
}
