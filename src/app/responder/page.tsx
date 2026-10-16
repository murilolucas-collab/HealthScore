"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { PerguntaInput } from "@/components/PerguntaInput";
import { useState } from "react";
import Image from "next/image";

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
  const [erroEnvio, setErroEnvio] = useState("");

  if (!db) return null;

  const ciclo = db.ciclosAvaliacao.find((c) => c.id === cicloId);
  const contato = db.contatosCliente.find((c) => c.id === contatoId);
  const cliente = contato ? db.clientes.find((c) => c.id === contato.clienteId) : undefined;
  const projeto = cliente ? db.projetos.find((p) => p.id === cliente.projetoId) : undefined;

  const linkValido = !!ciclo && !!projeto && !!cliente && !!contato && ciclo.projetoId === projeto.id;

  if (!linkValido) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Image src="/3pontos-company.jpg" alt="3Pontos Company" width={64} height={64} className="mx-auto mb-6 h-16 w-16 rounded-xl object-cover" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-teal-800">HealthScore · 3Pontos Company</p>
          <h1 className="mb-2 text-xl font-semibold">Link inválido</h1>
          <p className="text-sm text-neutral-500">
            Este link de pesquisa não é válido. Fale com o seu contato na agência para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (ciclo.status !== "ABERTO") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Image src="/3pontos-company.jpg" alt="3Pontos Company" width={64} height={64} className="mx-auto mb-6 h-16 w-16 rounded-xl object-cover" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-teal-800">HealthScore · 3Pontos Company</p>
          <h1 className="mb-2 text-xl font-semibold">Pesquisa encerrada</h1>
          <p className="text-sm text-neutral-500">Este ciclo de avaliação já foi encerrado. Obrigado pelo interesse!</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Image src="/3pontos-company.jpg" alt="3Pontos Company" width={64} height={64} className="mx-auto mb-6 h-16 w-16 rounded-xl object-cover" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-teal-800">Resposta registrada</p>
          <h1 className="mb-2 text-xl font-semibold">Obrigado, {contato.nome.split(" ")[0]}!</h1>
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
      setErroEnvio("Preencha ao menos uma resposta antes de enviar.");
      return;
    }
    setErroEnvio("");
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f8f8] px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-7 flex items-center gap-4 border-b border-neutral-100 pb-5">
          <Image src="/3pontos-company.jpg" alt="Logo 3Pontos Company" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" priority />
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-teal-800">3Pontos Company · HealthScore</p><p className="mb-0 text-xs text-neutral-500">Pesquisa de relacionamento</p></div>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">Sua opinião importa</p>
        <h1 className="mb-1 text-2xl font-bold">Pesquisa de satisfação</h1>
        <p className="mb-1 text-sm font-medium text-neutral-800">{cliente.nome}</p>
        <p className="text-sm text-neutral-500 mb-6">
          Olá, {contato.nome.split(" ")[0]}! Sua opinião sobre a {projeto.nome} nos ajuda a melhorar continuamente.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {geral.map((p, index) => (
            <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">Pergunta {index + 1}</p>
              <label className="block text-sm font-medium text-neutral-800 mb-3">{p.texto}</label>
              <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
            </div>
          ))}

          {porNicho.map((nicho) => {
            const perguntasNicho = perguntas.filter((p) => p.nicho === nicho);
            if (perguntasNicho.length === 0) return null;
            return (
              <div key={nicho} className="rounded-xl border border-neutral-200 bg-[#f8fbfb] p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 mb-3">{NICHO_LABELS[nicho]}</p>
                {perguntasNicho.map((p) => (
                  <div key={p.id} className="mb-4 last:mb-0">
                    <label className="block text-sm font-medium text-neutral-800 mb-3">{p.texto}</label>
                    <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
                  </div>
                ))}
              </div>
            );
          })}

          <div className="rounded-xl border border-neutral-200 p-4 sm:p-5">
            <label htmlFor="responder-sugestao" className="block text-sm font-medium text-neutral-800 mb-2">
              Deixe aqui a sua sugestão de melhoria (opcional):
            </label>
            <textarea id="responder-sugestao" name={`comentario_${geral[0]?.id}`} rows={3} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>

          {erroEnvio && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroEnvio}</p>}
          <p className="mb-0 text-xs text-neutral-500">Suas respostas são usadas para melhorar o acompanhamento e a qualidade das entregas.</p>
          <button type="submit" className="action-button action-primary w-full">
            Enviar respostas
          </button>
        </form>
      </div>
    </div>
  );
}
