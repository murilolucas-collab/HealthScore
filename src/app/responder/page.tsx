"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { PerguntaInput } from "@/components/PerguntaInput";
import { useState } from "react";

function extrairRespostas(formData: FormData) {
  const respostas: { perguntaId: string; nota: number; comentario: string | null }[] = [];
  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("nota_")) continue;
    const perguntaId = chave.slice("nota_".length);
    const notaStr = String(valor).trim();
    if (!notaStr) continue;
    const comentario = String(formData.get(`comentario_${perguntaId}`) ?? "").trim() || null;
    respostas.push({ perguntaId, nota: Number(notaStr), comentario });
  }
  return respostas;
}

const NICHO_LABELS: Record<string, string> = {
  COMUNICACAO: "Atendimento",
  ARTE: "Artes",
  GESTAO_TRAFEGO: "Anúncios online",
};

export default function ResponderPesquisaPage() {
  const searchParams = useSearchParams();
  const cicloId = searchParams.get("cicloId") ?? "";
  const contatoId = searchParams.get("contatoId") ?? "";
  const router = useRouter();
  const db = useDb();
  const [enviado, setEnviado] = useState(false);

  if (!db) return null;

  const ciclo = db.ciclosAvaliacao.find((c) => c.id === cicloId);
  const contato = db.contatosCliente.find((c) => c.id === contatoId);
  const cliente = contato ? db.clientes.find((c) => c.id === contato.clienteId) : undefined;
  const projeto = cliente ? db.projetos.find((p) => p.id === cliente.projetoId) : undefined;

  const linkValido = !!ciclo && !!projeto && !!cliente && !!contato && ciclo.projetoId === projeto.id;

  if (!linkValido) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">Link inválido</h1>
          <p className="text-sm text-neutral-500">
            Este link de pesquisa não é válido. Fale com o seu contato na agência para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (ciclo.status !== "ABERTO") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">Pesquisa encerrada</h1>
          <p className="text-sm text-neutral-500">Este ciclo de avaliação já foi encerrado. Obrigado pelo interesse!</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">Obrigado, {contato.nome.split(" ")[0]}!</h1>
          <p className="text-sm text-neutral-500">
            Suas respostas foram registradas. Agradecemos o retorno sobre a {projeto.nome}.
          </p>
        </div>
      </div>
    );
  }

  const perguntas = db.perguntasTemplate.filter((p) => p.polo === "ATIVO" && p.ativo);
  const geral = perguntas.filter((p) => !p.nicho);
  const porNicho = ["COMUNICACAO", "ARTE", "GESTAO_TRAFEGO"] as const;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const respostas = extrairRespostas(formData);
    if (respostas.length === 0) {
      alert("Preencha ao menos uma resposta");
      return;
    }
    mutateDb((dbW) => {
      dbW.respostasAtivas = dbW.respostasAtivas.filter((r) => !(r.cicloId === cicloId && r.contatoClienteId === contatoId));
      for (const r of respostas) {
        dbW.respostasAtivas.push({
          id: novoId("resp"),
          cicloId,
          contatoClienteId: contatoId,
          origem: "CLIENTE_DIRETO",
          preenchidoPorUsuarioId: null,
          perguntaId: r.perguntaId,
          nota: r.nota,
          comentario: r.comentario,
          respondidoEm: new Date().toISOString(),
        });
      }
    });
    setEnviado(true);
    router.replace(`/responder?cicloId=${cicloId}&contatoId=${contatoId}&enviado=1`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-xl border border-neutral-200 p-8">
        <h1 className="text-lg font-semibold text-neutral-900 mb-1">Pesquisa de satisfação — {cliente.nome}</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Olá, {contato.nome.split(" ")[0]}! Sua opinião sobre a {projeto.nome} nos ajuda a melhorar continuamente.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {geral.map((p) => (
            <div key={p.id}>
              <label className="block text-sm font-medium text-neutral-800 mb-2">{p.texto}</label>
              <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
            </div>
          ))}

          {porNicho.map((nicho) => {
            const perguntasNicho = perguntas.filter((p) => p.nicho === nicho);
            if (perguntasNicho.length === 0) return null;
            return (
              <div key={nicho} className="border-t border-neutral-100 pt-4">
                <p className="text-xs font-medium uppercase text-neutral-400 mb-2">{NICHO_LABELS[nicho]}</p>
                {perguntasNicho.map((p) => (
                  <div key={p.id} className="mb-2">
                    <label className="block text-sm text-neutral-800 mb-2">{p.texto}</label>
                    <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
                  </div>
                ))}
              </div>
            );
          })}

          <div className="border-t border-neutral-100 pt-4">
            <label className="block text-sm font-medium text-neutral-800 mb-2">
              Deixe aqui a sua sugestão de melhoria (opcional):
            </label>
            <textarea name={`comentario_${geral[0]?.id}`} rows={3} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>

          <button type="submit" className="w-full bg-neutral-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-neutral-800">
            Enviar respostas
          </button>
        </form>
      </div>
    </div>
  );
}
