import type { NextConfig } from "next";

// Deixou de ser export estático: agora existe uma rota de API
// (src/app/api/data/route.ts) rodando como função serverless na Vercel.
// É ela que guarda com segurança o token do GitHub (nunca chega ao
// navegador) e sincroniza os dados automaticamente, sem precisar de nenhuma
// configuração manual por quem usa o site.
const nextConfig: NextConfig = {};

export default nextConfig;
