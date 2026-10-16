import type { NextConfig } from "next";

// Deixou de ser export estático: agora existe uma rota de API
// (src/app/api/data/route.ts) rodando como função serverless na Vercel.
// É ela que guarda com segurança o token do GitHub (nunca chega ao
// navegador) e sincroniza os dados automaticamente, sem precisar de nenhuma
// configuração manual por quem usa o site.
const nextConfig: NextConfig = {
  // Fixa a raiz de tracing neste app e evita que um lockfile da pasta-mãe
  // faça o Next empacotar a pasta de trabalho errada no build da Vercel.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
