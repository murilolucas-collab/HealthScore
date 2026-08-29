// Cada escala categórica é mapeada para a mesma faixa 0-10 usada no resto do
// sistema, para que o cálculo de risco de churn nunca precise tratar escalas
// diferentes: só médias de números 0-10.
const OPCOES_POR_ESCALA: Record<string, { valor: number; label: string }[]> = {
  BOM_REGULAR_RUIM: [
    { valor: 10, label: "Bom" },
    { valor: 5, label: "Regular" },
    { valor: 0, label: "Ruim" },
  ],
  SIM_NAO: [
    { valor: 10, label: "Sim" },
    { valor: 0, label: "Não" },
  ],
  TEMPO_RESPOSTA_BUCKETS: [
    { valor: 10, label: "Até 1 hora" },
    { valor: 8, label: "Até 1 dia" },
    { valor: 6, label: "Até 2 dias" },
    { valor: 3, label: "3 a 5 dias" },
    { valor: 0, label: "Mais de 1 semana" },
  ],
};

export function PerguntaInput({
  perguntaId,
  tipoEscala,
}: {
  perguntaId: string;
  tipoEscala: string;
}) {
  const opcoes = OPCOES_POR_ESCALA[tipoEscala];
  if (opcoes) {
    return (
      <div className="flex flex-wrap gap-3">
        {opcoes.map((opcao) => (
          <label key={opcao.label} className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input type="radio" name={`nota_${perguntaId}`} value={opcao.valor} required />
            {opcao.label}
          </label>
        ))}
      </div>
    );
  }

  if (tipoEscala === "REUNIOES_MARCADAS_REALIZADAS") {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-700">
        <span>Marcadas</span>
        <input
          type="number"
          min={0}
          name={`marcadas_${perguntaId}`}
          className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-center"
        />
        <span>Realizadas</span>
        <input
          type="number"
          min={0}
          name={`realizadas_${perguntaId}`}
          className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-center"
        />
      </div>
    );
  }

  const max = tipoEscala === "LIKERT_1_5" ? 5 : 10;
  const min = tipoEscala === "LIKERT_1_5" ? 1 : 0;

  return (
    <input
      type="number"
      min={min}
      max={max}
      name={`nota_${perguntaId}`}
      placeholder={`${min}-${max}`}
      className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-center"
    />
  );
}
