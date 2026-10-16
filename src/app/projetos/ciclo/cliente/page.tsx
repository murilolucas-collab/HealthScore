"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth, podeAcessarProjeto, temPermissao } from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { mutateDb, novoId } from "@/lib/store";
import { calcularRiscoChurn } from "@/lib/churn";
import { Card, RiscoBadge, NichoLabel, PilarLabel, CategoriaLabel } from "@/components/ui";
import { PerguntaInput } from "@/components/PerguntaInput";
import CopyLinkButton from "@/components/CopyLinkButton";
import type { OrigemResposta } from "@/lib/types";

const NICHOS = ["COMUNICACAO", "ARTE", "GESTAO_TRAFEGO"] as const;
const PILARES = [
  "TEMPO_RESPOSTA",
  "QUALIDADE_ENTREGA",
  "CUMPRIMENTO_PRAZOS",
  "COMUNICACAO_PROATIVA",
  "RESULTADOS_PERFORMANCE",
  "REUNIOES_COMPARECIMENTO",
  "TEMPO_RESPOSTA_CLIENTE",
  "DEMANDA_QUANTIDADE",
  "PAGAMENTO_EM_DIA",
] as const;

function parseCsv(texto: string): string[][] {
  const conteudo = texto.replace(/^\uFEFF/, "");
  const registros: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;
  let fechouAspas = false;

  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];

    if (entreAspas) {
      if (caractere === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
          fechouAspas = true;
        }
      } else {
        campo += caractere;
      }
      continue;
    }

    if (fechouAspas) {
      if (caractere === " " || caractere === "\t") continue;
      if (caractere === ",") {
        linha.push(campo);
        campo = "";
        fechouAspas = false;
        continue;
      }
      if (caractere === "\r" || caractere === "\n") {
        linha.push(campo);
        registros.push(linha);
        linha = [];
        campo = "";
        fechouAspas = false;
        if (caractere === "\r" && conteudo[i + 1] === "\n") i++;
        continue;
      }
      throw new Error("CSV inválido: há caracteres inesperados após um campo entre aspas.");
    }

    if (caractere === '"') {
      if (campo.length > 0) throw new Error("CSV inválido: aspas devem começar no início de um campo.");
      entreAspas = true;
    } else if (caractere === ",") {
      linha.push(campo);
      campo = "";
    } else if (caractere === "\r" || caractere === "\n") {
      linha.push(campo);
      registros.push(linha);
      linha = [];
      campo = "";
      if (caractere === "\r" && conteudo[i + 1] === "\n") i++;
    } else {
      campo += caractere;
    }
  }

  if (entreAspas) throw new Error("CSV inválido: há um campo com aspas não fechadas.");
  if (campo.length > 0 || linha.length > 0 || fechouAspas) {
    linha.push(campo);
    registros.push(linha);
  }

  return registros.filter((registro) => registro.some((valor) => valor.trim() !== ""));
}

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

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("marcadas_")) continue;
    const perguntaId = chave.slice("marcadas_".length);
    const marcadas = Number(String(valor).trim());
    const realizadas = Number(String(formData.get(`realizadas_${perguntaId}`) ?? "").trim());
    if (!marcadas || Number.isNaN(realizadas)) continue;
    const nota = Math.max(0, Math.min(10, Math.round((realizadas / marcadas) * 10)));
    respostas.push({ perguntaId, nota, comentario: `${realizadas} de ${marcadas} reuniões realizadas` });
  }

  return respostas;
}

export default function CicloClienteDetalhePage() {
  const searchParams = useSearchParams();
  const projetoId = searchParams.get("projetoId") ?? "";
  const cicloId = searchParams.get("cicloId") ?? "";
  const clienteId = searchParams.get("clienteId") ?? "";
  const { user, pronto } = useAuth();
  const db = useDb();
  const [erroImportacao, setErroImportacao] = useState("");
  const [statusImportacao, setStatusImportacao] = useState("");

  if (!pronto || !db || !user) return null;
  if (!podeAcessarProjeto(user, projetoId)) return <p className="text-sm text-neutral-500">Sem acesso a este projeto.</p>;

  const ciclo = db.ciclosAvaliacao.find((c) => c.id === cicloId && c.projetoId === projetoId);
  if (!ciclo) return <p className="text-sm text-neutral-500">Ciclo não encontrado.</p>;
  const cliente = db.clientes.find((c) => c.id === clienteId && c.projetoId === projetoId);
  if (!cliente) return <p className="text-sm text-neutral-500">Cliente não encontrado neste projeto.</p>;

  const projeto = db.projetos.find((p) => p.id === projetoId)!;
  const podeCalcularSaude = temPermissao(user, "calcularSaude");
  const contatos = db.contatosCliente.filter((c) => c.clienteId === clienteId);
  const metasAtivas = db.metasCliente.filter((m) => m.clienteId === clienteId && m.ativa);
  const riscoChurn = db.riscosChurn.find((r) => r.cicloId === cicloId && r.clienteId === clienteId);
  const pontuacoes = db.pontuacoesCategoria.filter((p) => p.cicloId === cicloId && p.clienteId === clienteId);
  const metasDoCliente = metasAtivas.map((m) => m.id);
  const registrosMeta = db.registrosMeta.filter((r) => r.cicloId === cicloId && metasDoCliente.includes(r.metaClienteId));
  const perguntas = db.perguntasTemplate.filter((p) => p.ativo);
  const contatoIds = contatos.map((c) => c.id);
  const respostasAtivas = db.respostasAtivas
    .filter((r) => r.cicloId === cicloId && contatoIds.includes(r.contatoClienteId))
    .map((r) => ({ ...r, pergunta: perguntas.find((p) => p.id === r.perguntaId), contatoCliente: contatos.find((c) => c.id === r.contatoClienteId) }));
  const respostasPassivas = db.respostasPassivas
    .filter((r) => r.cicloId === cicloId && r.clienteId === clienteId)
    .map((r) => ({ ...r, pergunta: perguntas.find((p) => p.id === r.perguntaId), csUsuario: db.usuarios.find((u) => u.id === r.csUsuarioId) }));

  const perguntasAtivas = perguntas.filter((p) => p.polo === "ATIVO");
  const perguntasAtivasGerais = perguntasAtivas.filter((p) => !p.nicho);
  const perguntasPassivas = perguntas.filter((p) => p.polo === "PASSIVO");
  const pontuacoesAtivas = pontuacoes.filter((p) => p.polo === "ATIVO");
  const pontuacoesPassivas = pontuacoes.filter((p) => p.polo === "PASSIVO");
  const registroMetaPorMetaId = new Map(registrosMeta.map((r) => [r.metaClienteId, r.valorEntregue]));

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function handleRespostasAtivas(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const contatoClienteId = String(formData.get("contatoClienteId") ?? "");
    const origem = String(formData.get("origem") ?? "PROXY_INTERNO") as OrigemResposta;
    if (!contatoClienteId) {
      alert("Selecione o contato do cliente");
      return;
    }
    const respostas = extrairRespostas(formData);
    if (respostas.length === 0) {
      alert("Preencha ao menos uma resposta");
      return;
    }
    mutateDb((dbW) => {
      dbW.respostasAtivas = dbW.respostasAtivas.filter((r) => !(r.cicloId === cicloId && r.contatoClienteId === contatoClienteId));
      for (const r of respostas) {
        dbW.respostasAtivas.push({
          id: novoId("resp"),
          cicloId,
          contatoClienteId,
          origem,
          preenchidoPorUsuarioId: origem === "CLIENTE_DIRETO" ? null : user!.id,
          perguntaId: r.perguntaId,
          nota: r.nota,
          comentario: r.comentario,
          respondidoEm: new Date().toISOString(),
        });
      }
    });
    recalcularAutomaticamente();
  }

  function handleRespostasPassivas(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const respostas = extrairRespostas(formData);
    if (respostas.length === 0) {
      alert("Preencha ao menos uma resposta");
      return;
    }
    mutateDb((dbW) => {
      dbW.respostasPassivas = dbW.respostasPassivas.filter(
        (r) => !(r.cicloId === cicloId && r.clienteId === clienteId && r.csUsuarioId === user!.id)
      );
      for (const r of respostas) {
        dbW.respostasPassivas.push({
          id: novoId("resp"),
          cicloId,
          clienteId,
          csUsuarioId: user!.id,
          perguntaId: r.perguntaId,
          nota: r.nota,
          comentario: r.comentario,
          respondidoEm: new Date().toISOString(),
        });
      }
    });
    recalcularAutomaticamente();
  }

  async function handleImportarCSV(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const arquivo = formData.get("arquivo");
    setErroImportacao("");
    setStatusImportacao("");

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      setErroImportacao("Selecione um arquivo CSV.");
      return;
    }

    type RespostaImportada = {
      contatoClienteId: string;
      perguntaId: string;
      nota: number;
      comentario: string | null;
    };

    let respostasImportadas: RespostaImportada[];
    try {
      const linhas = parseCsv(await arquivo.text());
      const cabecalho = linhas.shift()?.map((valor) => valor.trim().toLowerCase());
      const cabecalhoEsperado = ["contatoclienteid", "perguntaid", "nota", "comentario"];
      if (!cabecalho || cabecalho.length !== cabecalhoEsperado.length || cabecalho.some((valor, indice) => valor !== cabecalhoEsperado[indice])) {
        throw new Error("Cabeçalho inválido. Use: contatoClienteId,perguntaId,nota,comentario.");
      }
      if (linhas.length === 0) throw new Error("O CSV não contém respostas para importar.");

      const contatosPermitidos = new Set(contatos.map((contato) => contato.id));
      const perguntasAtivasPermitidas = new Set(perguntasAtivas.map((pergunta) => pergunta.id));
      const validadas: RespostaImportada[] = [];

      linhas.forEach((linha, indice) => {
        if (linha.length !== cabecalhoEsperado.length) {
          throw new Error(`Registro ${indice + 2}: esperado 4 campos, mas foram encontrados ${linha.length}.`);
        }
        const [contatoClienteId, perguntaId, notaTexto, comentarioTexto] = linha.map((valor) => valor.trim());
        const nota = Number(notaTexto);
        if (!contatoClienteId || !contatosPermitidos.has(contatoClienteId)) {
          throw new Error(`Registro ${indice + 2}: contato não pertence a este cliente.`);
        }
        if (!perguntaId || !perguntasAtivasPermitidas.has(perguntaId)) {
          throw new Error(`Registro ${indice + 2}: pergunta ativa do polo cliente inválida.`);
        }
        if (!notaTexto || !Number.isFinite(nota) || nota < 0 || nota > 10) {
          throw new Error(`Registro ${indice + 2}: a nota deve ser um número entre 0 e 10.`);
        }
        validadas.push({
          contatoClienteId,
          perguntaId,
          nota,
          comentario: comentarioTexto || null,
        });
      });

      // Se o arquivo repetir o mesmo par, prevalece o último registro do próprio CSV.
      const porPar = new Map<string, RespostaImportada>();
      for (const resposta of validadas) {
        porPar.set(JSON.stringify([resposta.contatoClienteId, resposta.perguntaId]), resposta);
      }
      respostasImportadas = Array.from(porPar.values());
    } catch (erro) {
      setErroImportacao(erro instanceof Error ? erro.message : "Não foi possível ler o arquivo CSV.");
      return;
    }

    const paresImportados = new Set(
      respostasImportadas.map((resposta) => JSON.stringify([resposta.contatoClienteId, resposta.perguntaId]))
    );
    mutateDb((dbW) => {
      dbW.respostasAtivas = dbW.respostasAtivas.filter(
        (resposta) =>
          resposta.cicloId !== cicloId ||
          !paresImportados.has(JSON.stringify([resposta.contatoClienteId, resposta.perguntaId]))
      );
      const respondidoEm = new Date().toISOString();
      for (const r of respostasImportadas) {
        dbW.respostasAtivas.push({
          id: novoId("resp"),
          cicloId,
          contatoClienteId: r.contatoClienteId,
          perguntaId: r.perguntaId,
          nota: r.nota,
          comentario: r.comentario,
          origem: "IMPORTACAO_PLANILHA",
          preenchidoPorUsuarioId: null,
          respondidoEm,
        });
      }
    });
    recalcularAutomaticamente();
    form.reset();
    setStatusImportacao(`${respostasImportadas.length} resposta(s) importada(s) ou atualizada(s).`);
  }

  function handleMetasCiclo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const registros: { metaClienteId: string; valorEntregue: number }[] = [];
    for (const [chave, valor] of formData.entries()) {
      if (!chave.startsWith("metaEntregue_")) continue;
      const metaClienteId = chave.slice("metaEntregue_".length);
      const valorStr = String(valor).trim();
      if (!valorStr) continue;
      registros.push({ metaClienteId, valorEntregue: Number(valorStr) });
    }
    if (registros.length === 0) {
      alert("Preencha ao menos uma meta");
      return;
    }
    mutateDb((dbW) => {
      for (const r of registros) {
        const existente = dbW.registrosMeta.find((rm) => rm.metaClienteId === r.metaClienteId && rm.cicloId === cicloId);
        if (existente) existente.valorEntregue = r.valorEntregue;
        else
          dbW.registrosMeta.push({
            id: novoId("regmeta"),
            metaClienteId: r.metaClienteId,
            cicloId,
            valorEntregue: r.valorEntregue,
            criadoEm: new Date().toISOString(),
          });
      }
    });
    recalcularAutomaticamente();
  }

  function handleCalcular() {
    if (!podeCalcularSaude) return;
    try {
      calcularRiscoChurn(cicloId, clienteId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao calcular risco");
    }
  }

  function recalcularAutomaticamente() {
    if (!podeCalcularSaude) return;
    try {
      calcularRiscoChurn(cicloId, clienteId);
    } catch {
      // Sem dados suficientes ainda: o usuário poderá calcular depois.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href={`/projetos/detalhe?id=${projetoId}`} className="hover:text-neutral-900 hover:underline">{projeto.nome}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/projetos/ciclo?projetoId=${projetoId}&cicloId=${cicloId}`} className="hover:text-neutral-900 hover:underline">Ciclo</Link>
        <span aria-hidden="true">/</span>
        <span className="text-neutral-900">{cliente.nome}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Avaliação do cliente</p>
          <h1>{cliente.nome}</h1>
          <p className="mb-0 mt-2 text-sm text-neutral-500">
            Ciclo {format(new Date(ciclo.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
            {ciclo.dataFim && ` – ${format(new Date(ciclo.dataFim), "dd/MM/yyyy", { locale: ptBR })}`} · Status: {ciclo.status}
          </p>
        </div>
        <RiscoBadge nivel={riscoChurn?.nivelRisco} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-neutral-900">Risco de churn deste cliente</h2>
          {podeCalcularSaude && <button onClick={handleCalcular} className="action-button action-primary">
            {riscoChurn ? "Recalcular" : "Calcular risco de churn"}
          </button>}
        </div>
        {riscoChurn ? (
          <>
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <div className="text-neutral-500">Polo ativo (NPS · peso {riscoChurn.pesoAtivo * 100}%)</div>
                <div className="text-lg font-semibold">{riscoChurn.scoreAtivo?.toFixed(1) ?? "—"}</div>
              </div>
              <div>
                <div className="text-neutral-500">Polo passivo (equipe · peso {riscoChurn.pesoPassivo * 100}%)</div>
                <div className="text-lg font-semibold">{riscoChurn.scorePassivo?.toFixed(1) ?? "—"}</div>
              </div>
              <div>
                <div className="text-neutral-500">Saúde geral</div>
                <div className="text-lg font-semibold">{riscoChurn.scoreSaudeGeral.toFixed(1)}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm border-t border-neutral-100 pt-4">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400 mb-2">Por categoria — NPS do cliente</p>
                {pontuacoesAtivas.length > 0 ? (
                  <div className="space-y-1">
                    {pontuacoesAtivas.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span className="text-neutral-600">
                          <CategoriaLabel polo={p.polo} categoria={p.categoria} />
                        </span>
                        <span className="font-medium">{p.mediaNota.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-400">Sem respostas do polo ativo ainda.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400 mb-2">Por pilar — avaliação da equipe</p>
                {pontuacoesPassivas.length > 0 ? (
                  <div className="space-y-1">
                    {pontuacoesPassivas.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span className="text-neutral-600">
                          <CategoriaLabel polo={p.polo} categoria={p.categoria} />
                        </span>
                        <span className="font-medium">{p.mediaNota.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-400">Sem respostas do polo passivo ainda.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            Ainda não calculado. Registre respostas do polo ativo e/ou passivo e clique em calcular.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-1">Link para o cliente responder</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Envie este link diretamente ao contato do cliente. Ele preenche sem precisar de login e a resposta já entra
          como &quot;Cliente respondeu diretamente&quot;.
        </p>
        <div className="space-y-2">
          {contatos.map((c) => {
            const url = `${origin}/responder?cicloId=${cicloId}&contatoId=${c.id}`;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-neutral-800">{c.nome}</div>
                  <div className="text-xs text-neutral-400 truncate">{url}</div>
                </div>
                <CopyLinkButton url={url} />
              </div>
            );
          })}
          {contatos.length === 0 && <p className="text-sm text-neutral-500">Cadastre um contato do cliente para gerar o link.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="font-medium text-neutral-900 mb-1">Polo ativo — NPS do cliente</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Pode ser preenchido diretamente pelo cliente (via link acima), em nome dele por um admin/CS, ou importado
          via planilha CSV.
        </p>

        <form onSubmit={handleRespostasAtivas} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select name="contatoClienteId" aria-label="Contato do cliente" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="">
              <option value="">Contato do cliente...</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.email})
                </option>
              ))}
            </select>
            <select name="origem" aria-label="Origem das respostas" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="PROXY_INTERNO">
              <option value="CLIENTE_DIRETO">Cliente respondeu diretamente</option>
              <option value="PROXY_INTERNO">Preenchido por mim em nome do cliente</option>
            </select>
          </div>

          {perguntasAtivasGerais.length > 0 && (
            <div className="border-t border-neutral-100 pt-3">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Geral</h3>
              {perguntasAtivasGerais.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 items-start mb-2">
                  <div>
                    <p className="text-sm text-neutral-700 mb-1">{p.texto}</p>
                    <input name={`comentario_${p.id}`} placeholder="Comentário (opcional)" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                  </div>
                  <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
                </div>
              ))}
            </div>
          )}

          {NICHOS.map((nicho) => (
            <div key={nicho} className="border-t border-neutral-100 pt-3">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">
                <NichoLabel nicho={nicho} />
              </h3>
              {perguntasAtivas
                .filter((p) => p.nicho === nicho)
                .map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 items-start mb-2">
                    <div>
                      <p className="text-sm text-neutral-700 mb-1">{p.texto}</p>
                      <input name={`comentario_${p.id}`} placeholder="Comentário (opcional)" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                    </div>
                    <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
                  </div>
                ))}
            </div>
          ))}

          <button className="action-button action-primary">Salvar respostas do polo ativo</button>
        </form>

        {erroImportacao && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroImportacao}</p>}
        {statusImportacao && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{statusImportacao}</p>}
        <form onSubmit={handleImportarCSV} className="mt-4 border-t border-neutral-100 pt-4 flex items-center gap-2">
          <input type="file" name="arquivo" accept=".csv" aria-label="Arquivo CSV de respostas" required className="text-sm" />
          <button className="inline-action inline-action-secondary">
            Importar CSV (contatoClienteId,perguntaId,nota,comentario)
          </button>
        </form>

        {respostasAtivas.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-neutral-500">Respostas registradas:</p>
            {respostasAtivas.map((r) => (
              <div key={r.id} className="text-xs text-neutral-600 flex justify-between">
                <span>
                  {r.contatoCliente?.nome} · <NichoLabel nicho={r.pergunta?.nicho ?? ""} /> · {r.origem}
                </span>
                <span className="font-medium">{r.nota}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {metasAtivas.length > 0 && (
        <Card>
          <h2 className="font-medium text-neutral-900 mb-1">Metas — valor entregue neste ciclo</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Alimenta o pilar &quot;Meta Atingida&quot; do health score (relação entregue/alvo).
          </p>
          <form onSubmit={handleMetasCiclo} className="space-y-2">
            {metasAtivas.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <label className="text-sm text-neutral-700">
                  {m.nome} (alvo: {m.valorAlvo}
                  {m.unidade ? ` ${m.unidade}` : ""})
                </label>
                <input
                  type="number"
                  step="any"
                  name={`metaEntregue_${m.id}`}
                  defaultValue={registroMetaPorMetaId.get(m.id) ?? ""}
                  placeholder="Entregue"
                  className="w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-center"
                />
              </div>
            ))}
          <button className="action-button action-primary">Salvar metas entregues</button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="font-medium text-neutral-900 mb-1">Polo passivo — avaliação e métricas operacionais da equipe</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Preenchido pelo time interno (CS) sobre a saúde percebida do projeto: avaliação subjetiva (tempo de
          resposta, qualidade, prazos, comunicação, resultados) e métricas operacionais (reuniões, resposta do
          cliente, volume entregue, pagamento).
        </p>

        <form onSubmit={handleRespostasPassivas} className="space-y-4">
          {PILARES.map((pilar) => (
            <div key={pilar} className="border-t border-neutral-100 pt-3">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">
                <PilarLabel pilar={pilar} />
              </h3>
              {perguntasPassivas
                .filter((p) => p.pilar === pilar)
                .map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 items-start mb-2">
                    <div>
                      <p className="text-sm text-neutral-700 mb-1">{p.texto}</p>
                      <input name={`comentario_${p.id}`} placeholder="Comentário (opcional)" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                    </div>
                    <PerguntaInput perguntaId={p.id} tipoEscala={p.tipoEscala} />
                  </div>
                ))}
            </div>
          ))}

          <button className="action-button action-primary">Salvar minha avaliação (CS)</button>
        </form>

        {respostasPassivas.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-neutral-500">Respostas registradas:</p>
            {respostasPassivas.map((r) => (
              <div key={r.id} className="text-xs text-neutral-600 flex justify-between">
                <span>
                  {r.csUsuario?.nome} · <PilarLabel pilar={r.pergunta?.pilar ?? ""} />
                </span>
                <span className="font-medium">{r.nota}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
