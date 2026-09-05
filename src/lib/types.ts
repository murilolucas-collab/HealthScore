// Tipos que espelham o schema.prisma original do projeto. Antes viviam no
// banco (SQLite via Prisma); agora são apenas o formato dos dados guardados
// no localStorage do navegador — não há mais servidor nem banco de dados.

export type PapelUsuario = "ADMIN" | "PADRAO";
export type StatusCliente = "ATIVO" | "EM_RISCO" | "INATIVO";
export type StatusProjeto = "ATIVO" | "PAUSADO" | "ENCERRADO";
export type Periodicidade = "MENSAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL" | "PERSONALIZADO";
export type Nicho = "COMUNICACAO" | "ARTE" | "GESTAO_TRAFEGO";
export type PilarPassivo =
  | "TEMPO_RESPOSTA"
  | "QUALIDADE_ENTREGA"
  | "CUMPRIMENTO_PRAZOS"
  | "COMUNICACAO_PROATIVA"
  | "RESULTADOS_PERFORMANCE"
  | "REUNIOES_COMPARECIMENTO"
  | "TEMPO_RESPOSTA_CLIENTE"
  | "DEMANDA_QUANTIDADE"
  | "META_ATINGIDA"
  | "PAGAMENTO_EM_DIA";
export type Polo = "ATIVO" | "PASSIVO";
export type TipoEscala =
  | "NPS_0_10"
  | "LIKERT_1_5"
  | "BOM_REGULAR_RUIM"
  | "SIM_NAO"
  | "TEMPO_RESPOSTA_BUCKETS"
  | "REUNIOES_MARCADAS_REALIZADAS";
export type StatusCiclo = "ABERTO" | "FECHADO";
export type OrigemResposta = "CLIENTE_DIRETO" | "PROXY_INTERNO" | "IMPORTACAO_PLANILHA";
export type NivelRisco = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";
export type TendenciaRisco = "SUBINDO" | "ESTAVEL" | "CAINDO";
export type TipoEvento = "RECLAMACAO" | "INTERVENCAO" | "ACAO_CS" | "ELOGIO" | "MUDANCA_ESCOPO" | "OUTRO";
export type MotivoSaida =
  | "PRECO"
  | "RESULTADOS_INSATISFATORIOS"
  | "ATENDIMENTO_COMUNICACAO"
  | "CORTE_ORCAMENTO_CLIENTE"
  | "MUDANCA_ESTRATEGIA_CLIENTE"
  | "ENCERRAMENTO_EMPRESA_CLIENTE"
  | "CONCORRENCIA"
  | "PROBLEMAS_INTERNOS_AGENCIA"
  | "OUTRO";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
  criadoEm: string;
}

export interface AcessoProjeto {
  id: string;
  usuarioId: string;
  projetoId: string;
  criadoEm: string;
}

export interface Cliente {
  id: string;
  projetoId: string;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
  inicioContrato: string | null;
  status: StatusCliente;
  criadoEm: string;
}

export interface MetaCliente {
  id: string;
  clienteId: string;
  nome: string;
  valorAlvo: number;
  unidade: string | null;
  ativa: boolean;
  criadoEm: string;
}

export interface RegistroMeta {
  id: string;
  metaClienteId: string;
  cicloId: string;
  valorEntregue: number;
  criadoEm: string;
}

export interface FormularioSaida {
  id: string;
  clienteId: string;
  motivoPrincipal: MotivoSaida;
  detalhamento: string;
  poderiaSerEvitado: boolean;
  notaSatisfacaoGeral: number | null;
  responsavelId: string;
  dataSaida: string;
  criadoEm: string;
}

export interface ContatoCliente {
  id: string;
  clienteId: string;
  nome: string;
  cargo: string | null;
  email: string;
  telefone: string | null;
  principal: boolean;
  criadoEm: string;
}

export interface EventoCliente {
  id: string;
  clienteId: string;
  projetoId: string | null;
  tipo: TipoEvento;
  descricao: string;
  autorId: string;
  dataOcorrencia: string;
  criadoEm: string;
}

export interface PerfilRiscoCliente {
  id: string;
  clienteId: string;
  propensaoRisco: number;
  tendencia: TendenciaRisco;
  atualizadoEm: string;
}

export interface Projeto {
  id: string;
  nome: string;
  dataInicio: string | null;
  status: StatusProjeto;
  csResponsavelId: string | null;
  criadoEm: string;
}

export interface ConfiguracaoCiclo {
  id: string;
  projetoId: string;
  periodicidade: Periodicidade;
  diaDisparo: number;
  ativo: boolean;
}

export interface PerguntaTemplate {
  id: string;
  texto: string;
  polo: Polo;
  nicho: Nicho | null;
  pilar: PilarPassivo | null;
  tipoEscala: TipoEscala;
  ativo: boolean;
}

export interface CicloAvaliacao {
  id: string;
  projetoId: string;
  dataInicio: string;
  dataFim: string | null;
  status: StatusCiclo;
  criadoEm: string;
}

export interface RespostaAtiva {
  id: string;
  cicloId: string;
  perguntaId: string;
  contatoClienteId: string;
  origem: OrigemResposta;
  preenchidoPorUsuarioId: string | null;
  nota: number;
  comentario: string | null;
  respondidoEm: string;
}

export interface RespostaPassiva {
  id: string;
  cicloId: string;
  clienteId: string;
  perguntaId: string;
  csUsuarioId: string;
  nota: number;
  comentario: string | null;
  respondidoEm: string;
}

export interface PontuacaoCategoria {
  id: string;
  cicloId: string;
  clienteId: string;
  polo: Polo;
  categoria: string;
  mediaNota: number;
}

export interface RiscoChurn {
  id: string;
  cicloId: string;
  projetoId: string;
  clienteId: string;
  scoreAtivo: number | null;
  scorePassivo: number | null;
  pesoAtivo: number;
  pesoPassivo: number;
  scoreSaudeGeral: number;
  nivelRisco: NivelRisco;
  calculadoEm: string;
}

export interface IndicadorDesempenho {
  id: string;
  projetoId: string;
  periodo: string;
  indiceEngajamento: number | null;
  indiceAdocao: number | null;
  indiceMaturidade: number | null;
  criadoEm: string;
}

export interface Database {
  usuarios: Usuario[];
  acessosProjeto: AcessoProjeto[];
  clientes: Cliente[];
  metasCliente: MetaCliente[];
  registrosMeta: RegistroMeta[];
  formulariosSaida: FormularioSaida[];
  contatosCliente: ContatoCliente[];
  eventosCliente: EventoCliente[];
  perfisRisco: PerfilRiscoCliente[];
  projetos: Projeto[];
  configuracoesCiclo: ConfiguracaoCiclo[];
  perguntasTemplate: PerguntaTemplate[];
  ciclosAvaliacao: CicloAvaliacao[];
  respostasAtivas: RespostaAtiva[];
  respostasPassivas: RespostaPassiva[];
  pontuacoesCategoria: PontuacaoCategoria[];
  riscosChurn: RiscoChurn[];
  indicadoresDesempenho: IndicadorDesempenho[];
}
