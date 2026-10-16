"use client";

import { useEffect } from "react";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, podeAcessarProjeto, temPermissao } from "@/lib/auth-client";
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
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const cliente = db?.clientes.find((c) => c.id === id);
  const clienteEncerrado = cliente?.status === "INATIVO";

  useEffect(() => {
    if (clienteEncerrado && cliente) {
      router.replace(`/clientes/detalhe?id=${cliente.id}`);
    }
  }, [clienteEncerrado, cliente, router]);

  if (!pronto || !db || !user) return null;
  if (!cliente) return <p className="text-sm text-neutral-500">Cliente não encontrado.</p>;

  if (user.papel !== "ADMIN" && !podeAcessarProjeto(user, cliente.projetoId)) {
    return <p className="text-sm text-neutral-500">Cliente não encontrado.</p>;
  }

  if (!temPermissao(user, "gerenciarClientes") || !temPermissao(user, "alterarStatusCliente")) {
    return <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Seu usuário não tem permissão para encerrar clientes.</p>;
  }

  if (clienteEncerrado) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    const formData = new FormData(e.currentTarget);
    const motivoPrincipal = String(formData.get("motivoPrincipal") ?? "OUTRO") as MotivoSaida;
    const detalhamento = String(formData.get("detalhamento") ?? "").trim();
    const poderiaSerEvitado = formData.get("poderiaSerEvitado") === "on";
    const notaStr = String(formData.get("notaSatisfacaoGeral") ?? "").trim();
    const notaSatisfacaoGeral = notaStr ? Number(notaStr) : null;

    if (!detalhamento) {
      setErro("Descreva o que motivou a saída do cliente.");
      return;
    }
    if (notaSatisfacaoGeral !== null && (!Number.isFinite(notaSatisfacaoGeral) || notaSatisfacaoGeral < 0 || notaSatisfacaoGeral > 10)) {
      setErro("A nota de satisfação deve ser um número entre 0 e 10.");
      return;
    }

    setSalvando(true);
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500"><Link href={`/clientes/detalhe?id=${id}`} className="hover:underline">{cliente.nome}</Link><span aria-hidden="true">/</span><span>Encerramento</span></div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-red-700">Encerramento de contrato</p>
        <h1>Registrar saída</h1>
        <p className="mb-0 mt-2 text-sm text-neutral-500">
          {cliente.nome} — preencha os motivos antes de encerrar este cliente. Essa informação ajuda a mapear padrões
          de churn.
        </p>
      </div>

      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      <Card className="exit-form-card space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">Atenção · ação de encerramento</p><p className="mb-0 text-sm leading-relaxed text-red-900"><strong>Antes de confirmar:</strong> esta ação registra o motivo e muda o status do cliente para inativo. O histórico continuará disponível.</p></div>
          <div className="border-b border-neutral-100 pb-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">Registro de saída</p><h2 className="mb-0 text-base font-semibold">Conte-nos o que aconteceu</h2><p className="mb-0 mt-1 text-xs text-neutral-500">Os campos ajudam a identificar oportunidades de melhoria.</p></div>
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
            Essa saída poderia ter sido evitada pela agência?
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <button type="submit" disabled={salvando} className="rounded-md bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {salvando ? "Registrando saída…" : "Confirmar saída e encerrar cliente"}
          </button>
          <Link href={`/clientes/detalhe?id=${id}`} className="rounded-md border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancelar</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
