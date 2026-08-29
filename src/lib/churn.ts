"use client";

import { mutateDb, novoId } from "./store";
import type { Database, NivelRisco } from "./types";

function media(valores: number[]) {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function classificarRisco(scoreSaudeGeral: number): NivelRisco {
  if (scoreSaudeGeral >= 8) return "BAIXO";
  if (scoreSaudeGeral >= 6) return "MEDIO";
  if (scoreSaudeGeral >= 4) return "ALTO";
  return "CRITICO";
}

// Peso igual (50/50) entre polo ativo (NPS do cliente) e polo passivo (avaliação da equipe),
// por decisão explícita do negócio - ver conversa de definição do modelo.
const PESO_ATIVO = 0.5;
const PESO_PASSIVO = 0.5;

export function calcularRiscoChurn(cicloId: string) {
  return mutateDb((db) => {
    const ciclo = db.ciclosAvaliacao.find((c) => c.id === cicloId);
    if (!ciclo) throw new Error("Ciclo não encontrado");
    const projeto = db.projetos.find((p) => p.id === ciclo.projetoId);
    if (!projeto) throw new Error("Projeto não encontrado");

    const respostasAtivas = db.respostasAtivas.filter((r) => r.cicloId === cicloId);
    const respostasPassivas = db.respostasPassivas.filter((r) => r.cicloId === cicloId);
    const registrosMeta = db.registrosMeta.filter((r) => r.cicloId === cicloId);

    if (respostasAtivas.length === 0 && respostasPassivas.length === 0 && registrosMeta.length === 0) {
      throw new Error("Não há respostas registradas neste ciclo para calcular o risco");
    }

    const notasMetaAtingida = registrosMeta.map((r) => {
      const meta = db.metasCliente.find((m) => m.id === r.metaClienteId);
      const alvo = meta?.valorAlvo || 1;
      return Math.max(0, Math.min(10, Math.round((r.valorEntregue / alvo) * 10)));
    });

    const categoriasAtivas = new Map<string, number[]>();
    for (const r of respostasAtivas) {
      const pergunta = db.perguntasTemplate.find((p) => p.id === r.perguntaId);
      const chave = pergunta?.nicho ?? "GERAL";
      categoriasAtivas.set(chave, [...(categoriasAtivas.get(chave) ?? []), r.nota]);
    }

    const categoriasPassivas = new Map<string, number[]>();
    for (const r of respostasPassivas) {
      const pergunta = db.perguntasTemplate.find((p) => p.id === r.perguntaId);
      const chave = pergunta?.pilar ?? "GERAL";
      categoriasPassivas.set(chave, [...(categoriasPassivas.get(chave) ?? []), r.nota]);
    }
    if (notasMetaAtingida.length > 0) {
      categoriasPassivas.set("META_ATINGIDA", notasMetaAtingida);
    }

    for (const [categoria, notas] of categoriasAtivas) {
      const mediaNota = media(notas)!;
      const existente = db.pontuacoesCategoria.find(
        (p) => p.cicloId === cicloId && p.polo === "ATIVO" && p.categoria === categoria
      );
      if (existente) existente.mediaNota = mediaNota;
      else
        db.pontuacoesCategoria.push({
          id: novoId("pontuacao"),
          cicloId,
          polo: "ATIVO",
          categoria,
          mediaNota,
        });
    }
    for (const [categoria, notas] of categoriasPassivas) {
      const mediaNota = media(notas)!;
      const existente = db.pontuacoesCategoria.find(
        (p) => p.cicloId === cicloId && p.polo === "PASSIVO" && p.categoria === categoria
      );
      if (existente) existente.mediaNota = mediaNota;
      else
        db.pontuacoesCategoria.push({
          id: novoId("pontuacao"),
          cicloId,
          polo: "PASSIVO",
          categoria,
          mediaNota,
        });
    }

    const scoreAtivo = media(respostasAtivas.map((r) => r.nota));
    const scorePassivo = media([...respostasPassivas.map((r) => r.nota), ...notasMetaAtingida]);

    const scoreSaudeGeral =
      scoreAtivo !== null && scorePassivo !== null
        ? scoreAtivo * PESO_ATIVO + scorePassivo * PESO_PASSIVO
        : scoreAtivo ?? scorePassivo ?? 0;

    const nivelRisco = classificarRisco(scoreSaudeGeral);

    let riscoChurn = db.riscosChurn.find((r) => r.cicloId === cicloId);
    if (riscoChurn) {
      riscoChurn.scoreAtivo = scoreAtivo;
      riscoChurn.scorePassivo = scorePassivo;
      riscoChurn.pesoAtivo = PESO_ATIVO;
      riscoChurn.pesoPassivo = PESO_PASSIVO;
      riscoChurn.scoreSaudeGeral = scoreSaudeGeral;
      riscoChurn.nivelRisco = nivelRisco;
      riscoChurn.calculadoEm = new Date().toISOString();
    } else {
      riscoChurn = {
        id: novoId("risco"),
        cicloId,
        projetoId: ciclo.projetoId,
        clienteId: projeto.clienteId,
        scoreAtivo,
        scorePassivo,
        pesoAtivo: PESO_ATIVO,
        pesoPassivo: PESO_PASSIVO,
        scoreSaudeGeral,
        nivelRisco,
        calculadoEm: new Date().toISOString(),
      };
      db.riscosChurn.push(riscoChurn);
    }

    atualizarPerfilRiscoCliente(db, projeto.clienteId);

    return riscoChurn;
  });
}

function atualizarPerfilRiscoCliente(db: Database, clienteId: string) {
  const historico = db.riscosChurn
    .filter((r) => r.clienteId === clienteId)
    .sort((a, b) => new Date(b.calculadoEm).getTime() - new Date(a.calculadoEm).getTime())
    .slice(0, 2);

  const propensaoRisco = 100 - (historico[0]?.scoreSaudeGeral ?? 0) * 10;
  const propensaoAnterior =
    historico[1] !== undefined ? 100 - historico[1].scoreSaudeGeral * 10 : null;

  let tendencia: "SUBINDO" | "ESTAVEL" | "CAINDO" = "ESTAVEL";
  if (propensaoAnterior !== null) {
    if (propensaoRisco - propensaoAnterior > 5) tendencia = "SUBINDO";
    else if (propensaoAnterior - propensaoRisco > 5) tendencia = "CAINDO";
  }

  const existente = db.perfisRisco.find((p) => p.clienteId === clienteId);
  if (existente) {
    existente.propensaoRisco = propensaoRisco;
    existente.tendencia = tendencia;
    existente.atualizadoEm = new Date().toISOString();
  } else {
    db.perfisRisco.push({
      id: novoId("perfil"),
      clienteId,
      propensaoRisco,
      tendencia,
      atualizadoEm: new Date().toISOString(),
    });
  }
}
