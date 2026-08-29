export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200 p-5 ${className}`}>
      {children}
    </div>
  );
}

const RISCO_STYLES: Record<string, string> = {
  BAIXO: "bg-emerald-50 text-emerald-800 border-emerald-200",
  MEDIO: "bg-amber-50 text-amber-800 border-amber-200",
  ALTO: "bg-orange-50 text-orange-800 border-orange-200",
  CRITICO: "bg-red-50 text-red-800 border-red-200",
};

export function RiscoBadge({ nivel }: { nivel: string | null | undefined }) {
  if (!nivel) {
    return (
      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
        Sem cálculo
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${RISCO_STYLES[nivel] ?? ""}`}
    >
      {nivel}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ATIVO: "bg-emerald-50 text-emerald-800 border-emerald-200",
  EM_RISCO: "bg-orange-50 text-orange-800 border-orange-200",
  INATIVO: "bg-neutral-100 text-neutral-600 border-neutral-200",
  PAUSADO: "bg-amber-50 text-amber-800 border-amber-200",
  ENCERRADO: "bg-neutral-100 text-neutral-600 border-neutral-200",
  ABERTO: "bg-blue-50 text-blue-800 border-blue-200",
  FECHADO: "bg-neutral-100 text-neutral-600 border-neutral-200",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}
    >
      {status}
    </span>
  );
}

export function NichoLabel({ nicho }: { nicho: string }) {
  const labels: Record<string, string> = {
    COMUNICACAO: "Comunicação",
    ARTE: "Arte",
    GESTAO_TRAFEGO: "Gestão de Tráfego",
    GERAL: "Geral",
    "": "Geral",
  };
  return <>{labels[nicho] ?? nicho}</>;
}

export function PilarLabel({ pilar }: { pilar: string }) {
  const labels: Record<string, string> = {
    TEMPO_RESPOSTA: "Tempo de Resposta",
    QUALIDADE_ENTREGA: "Qualidade de Entrega",
    CUMPRIMENTO_PRAZOS: "Cumprimento de Prazos",
    COMUNICACAO_PROATIVA: "Comunicação Proativa",
    RESULTADOS_PERFORMANCE: "Resultados e Performance",
    REUNIOES_COMPARECIMENTO: "Comparecimento em Reuniões",
    TEMPO_RESPOSTA_CLIENTE: "Tempo de Resposta do Cliente",
    DEMANDA_QUANTIDADE: "Quantidade Entregue",
    META_ATINGIDA: "Meta Atingida",
    PAGAMENTO_EM_DIA: "Pagamento em Dia",
  };
  return <>{labels[pilar] ?? pilar}</>;
}

// Rótulo genérico para uma linha de PontuacaoCategoria, que guarda tanto
// categorias do polo ativo (Nicho) quanto do polo passivo (PilarPassivo).
export function CategoriaLabel({ polo, categoria }: { polo: string; categoria: string }) {
  return polo === "ATIVO" ? (
    <NichoLabel nicho={categoria} />
  ) : (
    <PilarLabel pilar={categoria} />
  );
}
