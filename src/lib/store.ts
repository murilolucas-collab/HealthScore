"use client";

// Substitui o Prisma + SQLite do projeto original. Não existe mais um banco
// tradicional: os dados ficam no localStorage do navegador (cache local
// rápido) e, quando configurado, são sincronizados com um arquivo JSON num
// repositório GitHub (ver github-sync.ts) — assim os dados acompanham quem
// acessa o app em qualquer dispositivo.

import bcrypt from "bcryptjs";
import type { Database } from "./types";

const STORAGE_KEY = "calculadora-churn-db-v1";

function emptyDb(): Database {
  return {
    usuarios: [],
    acessosProjeto: [],
    clientes: [],
    metasCliente: [],
    registrosMeta: [],
    formulariosSaida: [],
    contatosCliente: [],
    eventosCliente: [],
    perfisRisco: [],
    projetos: [],
    configuracoesCiclo: [],
    perguntasTemplate: [],
    ciclosAvaliacao: [],
    respostasAtivas: [],
    respostasPassivas: [],
    pontuacoesCategoria: [],
    riscosChurn: [],
    indicadoresDesempenho: [],
  };
}

export function novoId(prefixo: string = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefixo}_${crypto.randomUUID()}`;
  }
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readDb(): Database {
  if (!isBrowser()) return emptyDb();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<Database>;
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: Database) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("calculadora-db-changed"));
}

/** Lê o banco inteiro (uso interno da camada de dados). */
export function getDb(): Database {
  return readDb();
}

/** Substitui o banco inteiro (usado ao sincronizar com o GitHub). */
export function substituirDb(novaDb: Database) {
  writeDb(novaDb);
}

/** Aplica uma alteração ao banco de forma atômica e persiste. */
export function mutateDb<T>(fn: (db: Database) => T): T {
  const db = readDb();
  const resultado = fn(db);
  writeDb(db);
  return resultado;
}

export function limparTudo() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("calculadora-db-changed"));
}

// ---------- Exclusões em cascata (uso dentro de mutateDb) ----------
// Excluem o registro e tudo que depende diretamente dele, pra não deixar
// dado "órfão" no sistema. Isso é uma exclusão definitiva — diferente do
// fluxo de "formulário de saída", que é só um registro de negócio.

export function excluirProjeto(db: Database, projetoId: string) {
  const clientesDoProjeto = db.clientes.filter((c) => c.projetoId === projetoId).map((c) => c.id);
  for (const clienteId of clientesDoProjeto) {
    excluirDadosDoCliente(db, clienteId);
  }
  db.clientes = db.clientes.filter((c) => c.projetoId !== projetoId);

  const ciclosDoProjeto = db.ciclosAvaliacao.filter((c) => c.projetoId === projetoId).map((c) => c.id);
  db.respostasAtivas = db.respostasAtivas.filter((r) => !ciclosDoProjeto.includes(r.cicloId));
  db.respostasPassivas = db.respostasPassivas.filter((r) => !ciclosDoProjeto.includes(r.cicloId));
  db.pontuacoesCategoria = db.pontuacoesCategoria.filter((p) => !ciclosDoProjeto.includes(p.cicloId));
  db.riscosChurn = db.riscosChurn.filter((r) => r.projetoId !== projetoId);
  db.ciclosAvaliacao = db.ciclosAvaliacao.filter((c) => c.projetoId !== projetoId);
  db.configuracoesCiclo = db.configuracoesCiclo.filter((c) => c.projetoId !== projetoId);
  db.acessosProjeto = db.acessosProjeto.filter((a) => a.projetoId !== projetoId);
  db.indicadoresDesempenho = db.indicadoresDesempenho.filter((i) => i.projetoId !== projetoId);
  db.eventosCliente = db.eventosCliente.map((e) => (e.projetoId === projetoId ? { ...e, projetoId: null } : e));
  db.projetos = db.projetos.filter((p) => p.id !== projetoId);
}

// Remove tudo ligado a um cliente (respostas, contatos, metas, risco...) mas
// NÃO mexe no projeto — usado tanto por excluirCliente (projeto continua)
// quanto por excluirProjeto (que já cuida do projeto separadamente).
function excluirDadosDoCliente(db: Database, clienteId: string) {
  const contatosDoCliente = db.contatosCliente.filter((c) => c.clienteId === clienteId).map((c) => c.id);
  db.respostasAtivas = db.respostasAtivas.filter((r) => !contatosDoCliente.includes(r.contatoClienteId));
  db.respostasPassivas = db.respostasPassivas.filter((r) => r.clienteId !== clienteId);
  db.pontuacoesCategoria = db.pontuacoesCategoria.filter((p) => p.clienteId !== clienteId);
  db.riscosChurn = db.riscosChurn.filter((r) => r.clienteId !== clienteId);

  const metasDoCliente = db.metasCliente.filter((m) => m.clienteId === clienteId).map((m) => m.id);
  db.registrosMeta = db.registrosMeta.filter((r) => !metasDoCliente.includes(r.metaClienteId));
  db.metasCliente = db.metasCliente.filter((m) => m.clienteId !== clienteId);

  db.contatosCliente = db.contatosCliente.filter((c) => c.clienteId !== clienteId);
  db.eventosCliente = db.eventosCliente.filter((e) => e.clienteId !== clienteId);
  db.perfisRisco = db.perfisRisco.filter((p) => p.clienteId !== clienteId);
  db.formulariosSaida = db.formulariosSaida.filter((f) => f.clienteId !== clienteId);
}

export function excluirCliente(db: Database, clienteId: string) {
  excluirDadosDoCliente(db, clienteId);
  db.clientes = db.clientes.filter((c) => c.id !== clienteId);
}

export function excluirUsuario(db: Database, usuarioId: string) {
  db.acessosProjeto = db.acessosProjeto.filter((a) => a.usuarioId !== usuarioId);
  db.projetos = db.projetos.map((p) => (p.csResponsavelId === usuarioId ? { ...p, csResponsavelId: null } : p));
  db.usuarios = db.usuarios.filter((u) => u.id !== usuarioId);
}

export function excluirFormularioSaida(db: Database, formularioId: string) {
  db.formulariosSaida = db.formulariosSaida.filter((f) => f.id !== formularioId);
}

// ---------- Seed inicial (mesmos dados de exemplo do seed.ts original) ----------

export function garantirSeed() {
  if (!isBrowser()) return;
  const db = readDb();
  if (db.usuarios.length > 0) return;

  const agora = new Date().toISOString();

  const admin = {
    id: novoId("usuario"),
    nome: "Admin Geral",
    email: "admin@agencia.com",
    senhaHash: bcrypt.hashSync("admin123", 10),
    papel: "ADMIN" as const,
    criadoEm: agora,
  };
  const cs = {
    id: novoId("usuario"),
    nome: "Ana CS",
    email: "cs@agencia.com",
    senhaHash: bcrypt.hashSync("cs123456", 10),
    papel: "PADRAO" as const,
    criadoEm: agora,
  };
  db.usuarios.push(admin, cs);

  db.perguntasTemplate.push(
    { id: novoId("pergunta"), texto: "De 0 a 10, quanto você recomendaria a agência para alguém?", polo: "ATIVO", nicho: null, pilar: null, tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Como você avalia o atendimento da agência?", polo: "ATIVO", nicho: "COMUNICACAO", pilar: null, tipoEscala: "BOM_REGULAR_RUIM", ativo: true },
    { id: novoId("pergunta"), texto: "Como você avalia a qualidade das artes feitas pela agência?", polo: "ATIVO", nicho: "ARTE", pilar: null, tipoEscala: "BOM_REGULAR_RUIM", ativo: true },
    { id: novoId("pergunta"), texto: "Como você avalia a qualidade dos anúncios online feitos pela agência?", polo: "ATIVO", nicho: "GESTAO_TRAFEGO", pilar: null, tipoEscala: "BOM_REGULAR_RUIM", ativo: true },
    { id: novoId("pergunta"), texto: "Avalie o tempo de resposta da equipe às demandas e solicitações do cliente.", polo: "PASSIVO", nicho: null, pilar: "TEMPO_RESPOSTA", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Avalie a qualidade técnica e criativa das entregas realizadas neste ciclo.", polo: "PASSIVO", nicho: null, pilar: "QUALIDADE_ENTREGA", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Avalie o cumprimento dos prazos combinados com o cliente.", polo: "PASSIVO", nicho: null, pilar: "CUMPRIMENTO_PRAZOS", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Avalie a proatividade da equipe em comunicar riscos, mudanças e resultados ao cliente.", polo: "PASSIVO", nicho: null, pilar: "COMUNICACAO_PROATIVA", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Avalie os resultados/performance entregues frente às metas do projeto.", polo: "PASSIVO", nicho: null, pilar: "RESULTADOS_PERFORMANCE", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "Quantas reuniões foram marcadas e quantas foram realizadas neste ciclo?", polo: "PASSIVO", nicho: null, pilar: "REUNIOES_COMPARECIMENTO", tipoEscala: "REUNIOES_MARCADAS_REALIZADAS", ativo: true },
    { id: novoId("pergunta"), texto: "Em média, em quanto tempo o cliente responde às solicitações da equipe?", polo: "PASSIVO", nicho: null, pilar: "TEMPO_RESPOSTA_CLIENTE", tipoEscala: "TEMPO_RESPOSTA_BUCKETS", ativo: true },
    { id: novoId("pergunta"), texto: "A equipe entregou a quantidade de demandas combinada neste ciclo?", polo: "PASSIVO", nicho: null, pilar: "DEMANDA_QUANTIDADE", tipoEscala: "NPS_0_10", ativo: true },
    { id: novoId("pergunta"), texto: "O cliente está com os pagamentos em dia?", polo: "PASSIVO", nicho: null, pilar: "PAGAMENTO_EM_DIA", tipoEscala: "SIM_NAO", ativo: true }
  );

  const cliente = {
    id: novoId("cliente"),
    projetoId: "",
    nome: "Loja Exemplo Ltda",
    cnpj: null,
    segmento: "E-commerce",
    inicioContrato: "2025-01-15",
    status: "ATIVO" as const,
    criadoEm: agora,
  };

  const projeto = {
    id: novoId("projeto"),
    nome: "Gestão de Marketing 360",
    dataInicio: "2025-01-15",
    status: "ATIVO" as const,
    csResponsavelId: cs.id,
    criadoEm: agora,
  };
  cliente.projetoId = projeto.id;
  db.clientes.push(cliente);
  db.contatosCliente.push({
    id: novoId("contato"),
    clienteId: cliente.id,
    nome: "Carla Souza",
    cargo: "Marketing Manager",
    email: "carla@lojaexemplo.com",
    telefone: null,
    principal: true,
    criadoEm: agora,
  });
  db.perfisRisco.push({
    id: novoId("perfil"),
    clienteId: cliente.id,
    propensaoRisco: 0,
    tendencia: "ESTAVEL",
    atualizadoEm: agora,
  });

  db.projetos.push(projeto);
  db.configuracoesCiclo.push({
    id: novoId("config"),
    projetoId: projeto.id,
    periodicidade: "MENSAL",
    diaDisparo: 1,
    ativo: true,
  });
  db.acessosProjeto.push({
    id: novoId("acesso"),
    usuarioId: cs.id,
    projetoId: projeto.id,
    criadoEm: agora,
  });

  const PROJETOS_TESTE = [
    { projetoNome: "Código Pharma", darAcessoCS: true },
    { projetoNome: "Marketing Geral", darAcessoCS: false },
    { projetoNome: "VUPT ADS", darAcessoCS: false },
  ];
  const CLIENTES_TESTE = [
    { clienteNome: "Pharma Vida Saúde", segmento: "Saúde/Farma", contatoNome: "Renata Alves", contatoEmail: "renata@pharmavida.com" },
    { clienteNome: "Grupo Comércio Geral", segmento: "Varejo", contatoNome: "Bruno Lima", contatoEmail: "bruno@comerciogeral.com" },
    { clienteNome: "VUPT Mobilidade", segmento: "Mobilidade/Transporte", contatoNome: "Fernanda Costa", contatoEmail: "fernanda@vupt.com" },
  ];

  PROJETOS_TESTE.forEach((p, i) => {
    const c = CLIENTES_TESTE[i];
    const projetoTeste = {
      id: novoId("projeto"),
      nome: p.projetoNome,
      dataInicio: "2026-06-01",
      status: "ATIVO" as const,
      csResponsavelId: p.darAcessoCS ? cs.id : null,
      criadoEm: agora,
    };
    db.projetos.push(projetoTeste);
    db.configuracoesCiclo.push({
      id: novoId("config"),
      projetoId: projetoTeste.id,
      periodicidade: "MENSAL",
      diaDisparo: 1,
      ativo: true,
    });
    if (p.darAcessoCS) {
      db.acessosProjeto.push({
        id: novoId("acesso"),
        usuarioId: cs.id,
        projetoId: projetoTeste.id,
        criadoEm: agora,
      });
    }

    const clienteTeste = {
      id: novoId("cliente"),
      projetoId: projetoTeste.id,
      nome: c.clienteNome,
      cnpj: null,
      segmento: c.segmento,
      inicioContrato: "2026-06-01",
      status: "ATIVO" as const,
      criadoEm: agora,
    };
    db.clientes.push(clienteTeste);
    db.contatosCliente.push({
      id: novoId("contato"),
      clienteId: clienteTeste.id,
      nome: c.contatoNome,
      cargo: null,
      email: c.contatoEmail,
      telefone: null,
      principal: true,
      criadoEm: agora,
    });
    db.perfisRisco.push({
      id: novoId("perfil"),
      clienteId: clienteTeste.id,
      propensaoRisco: 0,
      tendencia: "ESTAVEL",
      atualizadoEm: agora,
    });
  });

  writeDb(db);
}
